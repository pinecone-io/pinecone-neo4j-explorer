import { useAppContext } from "../AppContext"
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

const fetchSearchData = async (query: string) => {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

export const SearchInput = () => {
  const queryClient = useQueryClient();

  const { setQueryResult, setInferredData, setSummary, setGraphData, setCypherQueryResult } = useAppContext()
  const [query, setQuery] = useState('')

  const { data, error, refetch, isLoading, isFetched, isSuccess } = useQuery({
    queryKey: ['searchData', query],
    queryFn: () => query && fetchSearchData(query),
    enabled: false, // Disable automatic query execution    
    staleTime: 2000,
  });

  useEffect(() => {
    if (data) setQueryResult(data);
  }, [data, setQueryResult]);

  const handleSearch = useCallback(async () => {
    setInferredData(null);
    setSummary(null);
    setGraphData(null);
    setCypherQueryResult(null);
    await queryClient.cancelQueries({ queryKey: ['searchData', query]});
    await queryClient.invalidateQueries({ queryKey: ['searchData', query]});
    await refetch();
  }, [query, refetch, queryClient, setInferredData, setSummary, setGraphData, setCypherQueryResult]);


  
  return (
    <>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="min-w-[200px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-lg shadow-gray-900/5 placeholder:text-gray-500 focus:border-gray-400 focus:shadow-md focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="bg-blue-500 text-white shadow-md flex items-center justify-center min-w-[100px] h-[35px] mt-1 ml-5 rounded-md disabled:opacity-70"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "Search"
          )}
        </button>
      </>
  )
}