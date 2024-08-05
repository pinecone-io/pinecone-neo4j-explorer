import React, { createContext, useState, useContext, ReactNode } from 'react';

interface AppContextType {
  selectedData: { nodes: string[] | null | undefined, transactions: string[] | null | undefined };
  setSelectedData: (data: string[] | null | undefined) => void;
  selectedLink: string | null;
  setSelectedLink: (link: string | null) => void;
  hoveredLink: string | null;
  setHoveredLink: (link: string | null) => void;
  hoveredNode: string | null;
  setHoveredNode: (node: string | null) => void;
  summary: string | null;
  setSummary: (summary: string | null) => void;
  inferredData: any;
  setInferredData: (data: any) => void;
  cypherQueryResult: any;
  setCypherQueryResult: (data: any) => void;
  isFlipped: boolean;
  setIsFlipped: (isFlipped: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedData, setSelectedData] = useState<{ nodes: string[] | null | undefined, transactions: string[] | null | undefined }>({ nodes: null, transactions: null });
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [inferredData, setInferredData] = useState<any>(null);
  const [cypherQueryResult, setCypherQueryResult] = useState<any>(null);
  const [isFlipped, setIsFlipped] = useState(false);


  return (
    <AppContext.Provider value={{
      selectedData,
      setSelectedData: (data) => setSelectedData({ nodes: data, transactions: [] }),
      selectedLink,
      setSelectedLink,
      hoveredLink,
      setHoveredLink,
      hoveredNode,
      setHoveredNode,
      summary,
      setSummary,
      inferredData,
      setInferredData,
      cypherQueryResult,
      setCypherQueryResult,
      isFlipped,
      setIsFlipped
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};