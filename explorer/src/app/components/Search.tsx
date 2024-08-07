import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown'
import { Input, Button, Spinner, Card, Typography } from "@material-tailwind/react";
import { useAppContext } from '../AppContext';
import { isEqual } from 'lodash';




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
    hoveredNode,
    setSummary,
    summary,
    isFlipped
  } = useAppContext();

  const prevDataRef = useRef();

  const [opinion, setOpinion] = useState<string | undefined>('');

  const { queryResult } = useAppContext();

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
  }, [hoveredNode]);


  useEffect(() => {
    if (queryResult && !isEqual(prevDataRef.current, queryResult)) {
      
      setSelectedData(queryResult.caseIds);
      setSummary(queryResult.summary);
      prevDataRef.current = queryResult;
    }
  }, [queryResult, setSelectedData, setSummary]);

  return (
    <div className="flex flex-col overflow-hidden">
      
      {/* {error && <Typography color="red" className="mt-2">{error.message}</Typography>} */}
      {queryResult && (
        <div className="mt-2 flex-1 overflow-hidden">
          <div className="h-[90vh] overflow-y-auto">
            <Card className="p-4 mb-2">
              <Typography variant="h6" color="blue-gray" className="mb-2 border-b border-gray-300">
                {isFlipped ? "Opinion" : "Summary"}
              </Typography>
              <Markdown>{isFlipped ? opinion : summary}</Markdown>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export { Search };