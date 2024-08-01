'use client'
import { useCallback, useState } from "react";
import { Graph } from "./components/Graph";
import { Search } from "./components/Search";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { question } from "./actions/question";
import { JsonToTable } from "react-json-to-table";

const queryClient = new QueryClient();

export default function Home() {
  const [selectedData, setSelectedData] = useState<{ nodes: string[] | null | undefined, transactions: string[] | null | undefined }>({ nodes: null, transactions: null });
  const [selectedLink, setSelectedLink] = useState<string|null>(null);
  const [hoveredLink, setHoveredLink] = useState<string|null>(null);
  const [hoveredNode, setHoveredNode] = useState<string|null>(null);
  const [summary, setSummary] = useState<string|null>(null);

  const [cypherQueryResult, setCypherQueryResult] = useState<any>(null);

   const handleSearchSelect = useCallback((selectedCaseIds: string[] | null | undefined) => {    
    setSelectedData({ nodes: selectedCaseIds, transactions: [] });
  }, []);

  const handleSummaryUpdated = useCallback((summary: string | null) => {
    setSummary(summary);
  }, []);


  const handleCypherSelected = useCallback(async (cypher: string) => {
    const result = await question(cypher)
    console.log("result", result)
    setCypherQueryResult(result)
  }, []);
  
  return (
     <QueryClientProvider client={queryClient}>
      <div className="box-border flex relative flex-col shrink-0 mt-5 h-screen">
        <div className="box-border relative pt-5 pl-5 mt-5 text-3xl h-[75px]">
          Pinecone Graph Explorer
        </div>
        <div className="box-border flex relative flex-col grow shrink-0 pb-1 mt-5 pl-10 pr-10mb-5 h-auto bg-gray-800">
          <div className="box-border flex relative flex-col shrink-0 mt-5">
            <div className="flex gap-5 max-md:flex-col">
              <div className="flex flex-col w-6/12 max-md:ml-0 max-md:w-full">
                <div className="box-border flex relative flex-col grow shrink-0 mt-5 h-auto">
                  <Search 
                    onSearchSelect={handleSearchSelect} 
                    selectedLink={selectedLink} 
                    hoveredLink={hoveredLink}
                    hoveredNode={hoveredNode}
                    onSummaryUpdated={handleSummaryUpdated}
                  />
                </div>
                {/* <div className="box-border flex relative flex-col grow shrink-0 mt-5 h-auto bg-white" /> */}
              </div>
              <div className="flex flex-col ml-5 w-6/12 max-md:ml-0 max-md:w-full">
                <div className="box-border flex relative flex-col grow shrink-0 mt-5 h-[33vh] rounded-lg overflow-y-scroll bg-white text-black">
                  {
                    cypherQueryResult && cypherQueryResult.length > 0 && (
                      <JsonToTable json={cypherQueryResult} />
                    )
                  }
                  {
                    cypherQueryResult && cypherQueryResult.length === 0 && (
                      <div>No results</div>
                    )
                  }
                </div>
                <div className="box-border flex relative flex-col grow shrink-0 mt-5 h-auto">
                  <Graph 
                    selectedNodes={selectedData.nodes} 
                    selectedTransactions={[]}
                    onSelectedLink={(selectedLink: string) => {setSelectedLink(selectedLink)}} 
                    onHoveredLink={(hoveredLink: string) => {setHoveredLink(hoveredLink)}}
                    onHoveredNode={(id: string) => {setHoveredNode(id)}}
                    onCypherSelected={handleCypherSelected}
                    summary={summary}
                  />                
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* <div className="flex flex-col h-screen">
        <div className="flex h-3/4 p-4">
          <div className="w-1/2 p-4">
            <Graph 
              selectedNodes={selectedData.nodes} 
              selectedTransactions={[]} 
              onSelectedLink={(selectedLink: string) => {setSelectedLink(selectedLink)}} 
              onHoveredLink={(hoveredLink: string) => {setHoveredLink(hoveredLink)}}
              onHoveredNode={(id: string) => {setHoveredNode(id)}}
              onCypherSelected={handleCypherSelected}
              summary={summary}
            />
          </div>
          <div className="w-1/2 p-4">
            <Search 
              onSearchSelect={handleSearchSelect} 
              selectedLink={selectedLink} 
              hoveredLink={hoveredLink}
              hoveredNode={hoveredNode}
              onSummaryUpdated={handleSummaryUpdated}
            />
          </div>
        </div>
        <div className="h-1/4 w-full p-4 bg-white text-black">
          {
            cypherQueryResult && cypherQueryResult.length > 0 && (
              <JsonToTable json={cypherQueryResult} />
            )
          }
          {
            cypherQueryResult && cypherQueryResult.length === 0 && (
              <div>No results</div>
            )
          }
          
        </div>
      </div> */}
    </QueryClientProvider>
  );
}