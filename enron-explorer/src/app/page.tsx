'use client'
import { useCallback, useState } from "react";
import { Graph } from "./components/Graph";
import { Search } from "./components/Search";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function Home() {
  const [selectedData, setSelectedData] = useState<{ nodes: string[] | null | undefined, transactions: string[] | null | undefined }>({ nodes: null, transactions: null });
  const [selectedLink, setSelectedLink] = useState<string|null>(null);
  const [hoveredLink, setHoveredLink] = useState<string|null>(null);

   const handleSearchSelect = useCallback((selectedEmailAddresses: string[] | null | undefined, selectedTransactions: string[] | null | undefined) => {
    console.log("SELECTED EMAIL ADDRESSES", selectedEmailAddresses);
    console.log("SELECTED TRANSACTIONS", selectedTransactions);
    setSelectedData({ nodes: selectedEmailAddresses, transactions: selectedTransactions });
  }, []);
  
  return (
     <QueryClientProvider client={queryClient}>
      <div className="flex p-4">
        <div className="w-1/2 p-4">
          <Graph selectedNodes={selectedData.nodes} selectedTransactions={selectedData.transactions} onSelectedLink={(selectedLink: string) => {setSelectedLink(selectedLink)}} onHoveredLink={(hoveredLink: string) => {setHoveredLink(hoveredLink)}}/>
        </div>
        <div className="w-1/2 p-4">
          <Search onSearchSelect={handleSearchSelect} selectedLink={selectedLink} hoveredLink={hoveredLink}/>
        </div>
      </div>
    </QueryClientProvider>
  );
}
