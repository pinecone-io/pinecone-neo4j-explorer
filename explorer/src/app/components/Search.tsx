import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown'
import { Input, Button, Spinner, Card, Typography } from "@material-tailwind/react";
import { useAppContext } from '../AppContext';
import { isEqual } from 'lodash';


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

const fetchGetOpinion = async (id: string) => {
  const response = await fetch(`/api/opinion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ "caseId":id }),
  });
  return response.json();
};


const Search = () => {
  const {
    setSelectedData,
    selectedLink,
    hoveredLink,
    hoveredNode,
    setSummary,
    isFlipped
  } = useAppContext();

  const prevDataRef = useRef();


  const [query, setQuery] = useState<string | undefined>('');
  const [opinion, setOpinion] = useState<string | undefined>('');
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
      setQuery(selectedLink);
      handleSearch();
    }
  }, [selectedLink, handleSearch]);

  useEffect(() => {
    
      const getOpinion = async () => {
        if (hoveredNode) {
          const response = await fetchGetOpinion(hoveredNode);
          // console.log(response)
          setOpinion(response.content)
        }
      }
      
    if (hoveredNode) {
      getOpinion()
    }
  }, [hoveredNode, handleSearch]);


  useEffect(() => {
    if (isSuccess && data && !isEqual(prevDataRef.current, data)) {
      console.log("DATA", data);
      setSelectedData(data.caseIds);
      setSummary(data.summary);
      prevDataRef.current = data;
    }
  }, [isSuccess, data, setSelectedData, setSummary]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="mt-1 flex gap-4">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="!border !border-gray-300 bg-white text-gray-900 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
          labelProps={{
            className: "hidden",
          }}
          containerProps={{ className: "min-w-[200px]" }} crossOrigin={undefined}/>
        <Button 
          onClick={handleSearch} 
          className="bg-blue-500 text-white shadow-md flex items-center justify-center min-w-[100px] h-[35px] mt-1"
          disabled={isLoading}
        >
          {isLoading ? (
            <Spinner className="h-3 w-5 text-white" />
          ) : (
            "Search"
          )}
        </Button>
      </div>
      {error && <Typography color="red" className="mt-2">{error.message}</Typography>}
      {data && (
        <div className="mt-2 flex-1 overflow-hidden">
          <div className="h-[90vh] overflow-y-auto">
            <Card className="p-4 mb-2">
              <Typography variant="h6" color="blue-gray" className="mb-2">
                {isFlipped ? "Opinion" : "Summary"}
              </Typography>
              <Markdown>{isFlipped ? opinion : data.summary}</Markdown>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export { Search };