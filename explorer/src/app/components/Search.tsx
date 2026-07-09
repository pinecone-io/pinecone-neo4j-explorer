import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown'
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
    setSummary,
    hoveredNode,    
    summary,
    isFlipped
  } = useAppContext();

  const prevDataRef = useRef<any>(undefined);

  const [opinion, setOpinion] = useState<string | undefined>('');

  const { queryResult } = useAppContext();

  useEffect(() => {    
      const getOpinion = async () => {
        if (hoveredNode) {
          const response = await fetchGetOpinion(hoveredNode);
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
      {queryResult && summary && (
        <div className="mt-2 flex-1 overflow-hidden">
          <div className="h-[90vh] overflow-y-auto">
            <div className="rounded-xl bg-white shadow-md p-4 mb-2">
              <h6 className="text-base font-semibold text-gray-800 mb-2 border-b border-gray-300">
                {isFlipped ? "Opinion" : "Summary"}
              </h6>
              <Markdown>{isFlipped ? opinion : summary}</Markdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { Search };