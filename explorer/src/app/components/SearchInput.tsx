import { Button, Input, Spinner } from "@material-tailwind/react"
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
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="!border !border-gray-300 bg-white text-gray-900 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:shadow-md"
          labelProps={{
            className: "hidden",
          }}
          containerProps={{ className: "min-w-[200px]" }} crossOrigin={undefined}/>
        <Button 
          onClick={handleSearch} 
          className="bg-blue-500 text-white shadow-md flex items-center justify-center min-w-[100px] h-[35px] mt-1 ml-5"
          disabled={isLoading}
        >
          {isLoading ? (
            <Spinner className="h-3 w-5 text-white" />
          ) : (
            "Search"
          )}
        </Button>
      </>
  )
}