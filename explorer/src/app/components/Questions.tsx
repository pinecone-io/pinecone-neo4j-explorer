
import { useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { question } from "../actions/question";

const Questions = ()  => {
  const { inferredData, setCypherQueryResult } = useAppContext();

  const handleCypherSelected = async (cypher: string) => {
    setCypherQueryResult(null);
    const result = await question(cypher)    
    setCypherQueryResult(result)
  };
  
  return (<div style={{zIndex: 1000}} className="mb-3">
    {inferredData && inferredData.entries && inferredData.entries.length > 0 && (
      <div className="rounded-lg overflow-y-scroll text-black mr-2 mt-2">
        {inferredData.entries.map((entry: any) => (
          <div 
            onClick={() => handleCypherSelected(entry.cypher)} 
            key={entry.question} 
            className="cursor-pointer mb-2 transition-all duration-300 ease-in-out shadow-sm hover:shadow-md bg-white rounded-lg p-3"
          >
            <div className="mb-2">{entry.question}</div>
            <div className="mb-2 text-[10px] text-gray-400">{entry.cypher}</div>
          </div>
        ))}
      </div>
    )}
  </div>)
}

export { Questions };