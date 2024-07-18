import type { MatchMetadata } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown'
import { type ScoredPineconeRecord } from '@pinecone-database/pinecone';


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


const Search = ({ onSearchSelect, selectedLink, hoveredLink }: { 
  onSearchSelect: (selectedEmailAddresses: string[] | undefined, selectedTransactions: string[] | undefined) => void, 
  selectedLink: string |  null, hoveredLink: string | null}) => 
  {
  const [query, setQuery] = useState<string | undefined>('');
  const queryClient = useQueryClient();
  const { data, error, refetch, isLoading, isFetched, isSuccess } = useQuery({
    queryKey: ['searchData', query],
    queryFn: () => query && fetchSearchData(query),
    enabled: false, // Disable automatic query execution    
    staleTime: 2000
  });
  const handleSearch = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: ['searchData', query]});
    await queryClient.invalidateQueries({ queryKey: ['searchData', query]});
    await refetch();
  }, [query, refetch, queryClient]);

  useEffect(() => {
    if (selectedLink) {
      console.log("SELECTED LINK", selectedLink)
      setQuery(selectedLink);
      handleSearch();
    }
  }, [selectedLink, handleSearch]);

  // useEffect(() => {
  //   if (query) {
  //     handleSearch();
  //   }
  // }, [query, handleSearch]);

  useEffect(() => {
    if (isSuccess && data) {
      console.log("DATA", data);
      onSearchSelect(data.uniqueEmailTo, data.matches.map((match: ScoredPineconeRecord<MatchMetadata>) => match.metadata?.transaction_id));
    }
  }, [isSuccess, data, onSearchSelect]);

  return (
    <div className="mb-10">
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="text-black p-2"
        />
        <button onClick={handleSearch} className="text-black bg-white ml-4 p-2">Search</button>
        <button onClick={() => {setQuery(undefined)}} className="text-black bg-white ml-4 p-2">Clear</button>
        {isLoading && <div className="text-black bg-white"><div className="spinner"></div>Loading...</div>}
      </div>
      {error && <div className="text-black">An error occurred: {error.message}</div>}
      {data && (
        <div className="mt-2 h-full grid grid-rows-5 gap-2" style={{ height: 'calc(100vh - 200px)' }}>
          <ul className="text-black overflow-y-auto row-span-1">
            {data.uniqueEmailTo.map((emailTo: string, index: number) => (
              <li className="bg-white cursor-pointer m-1 p-1 text-black" key={index} onClick={() => {
                // console.log(emailTo)
                onSearchSelect([emailTo], undefined)
              }}>{emailTo}</li>
            ))}
          </ul>
          <div className="bg-white text-black p-1 overflow-y-auto row-span-2">
            <Markdown>{data.summary}</Markdown>
          </div>
          <div className="bg-white text-black p-1 overflow-y-auto row-span-2">
            <Markdown>{hoveredLink}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
};

export { Search };