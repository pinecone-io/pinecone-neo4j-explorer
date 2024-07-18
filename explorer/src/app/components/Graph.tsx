'use client'
import dynamic from 'next/dynamic';

import * as THREE from 'three';
import { useQuery } from '@tanstack/react-query';
import SpriteText from 'three-spritetext';
import { useEffect, useRef, useState } from 'react';
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });


const fetchGraphData = async (selectedNodes: string[]) => {
  const response = await fetch('/api/graph', {
    method: 'POST',
    body: JSON.stringify({ selectedNodes }),
  });
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

const Graph = ({ selectedNodes, selectedTransactions, onSelectedLink, onHoveredLink }: {selectedNodes: string[] | null | undefined, selectedTransactions: string[] | null | undefined, onSelectedLink: (text: string) => void, onHoveredLink: (text: string) => void}) => {
  const [localSelectedNodes, setLocalSelectedNodes] = useState<string[] | null | undefined>(null);
  const [selectedNode, setSelectedNode] = useState<string | null | undefined>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['graphData', localSelectedNodes],
    queryFn: () => localSelectedNodes && fetchGraphData(localSelectedNodes),
    enabled: false,
  });

  const [graph, setGraph] = useState<any>(null);

  useEffect(() => {
    if (data) {
      console.log(data.data)
      setGraph(data.data);
    }
  }, [data]);

  useEffect(() => {
    if (selectedNodes) {
      setLocalSelectedNodes(selectedNodes);
    }
  }, [selectedNodes]);

  useEffect(() => {
    if (selectedNode) {
      setLocalSelectedNodes([selectedNode]);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (localSelectedNodes) {
      refetch();
    }
  }, [localSelectedNodes, refetch]);

  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [highlightNodes, setHighlightNodes] = useState(new Set());

  const updateHighlight = () => {
    setHighlightNodes(new Set(highlightNodes));
    setHighlightLinks(new Set(highlightLinks));
  };

  const handleLinkHover = (link: any) => {
    highlightNodes.clear();
    
    if (link) {
      highlightLinks.clear();
      highlightLinks.add(link);
      highlightNodes.add(link.source);
      highlightNodes.add(link.target);
      onHoveredLink(link ? link.body : '');
      updateHighlight();
    }
  };

  const fgRef = useRef();

  if (isLoading) return 'Loading...';
  if (error) return `An error has occurred: ${error.message}`;
  
  

  return (
    <div>
    {data && (
      <ForceGraph2D 
        nodeColor={(node) => {
          
          const opacity = Math.min(node.inEdgesCount.low / 10, 10); // Adjust the divisor to control the opacity scaling
          return `rgba(0, 0, 255, ${opacity})`; // Base color is blue with varying opacity
        }}
        ref={fgRef}
        width={600}
        onEngineStop={() => (fgRef.current as any)?.zoomToFit(600)}
        onDagError={(e) => console.error(e)}
        linkColor={(link) => {
          if (selectedTransactions && selectedTransactions.includes(link.transaction_id)) {
            return !highlightLinks.has(link) ? 'rgba(255, 165, 0, 1)' : 'orange';
          }
          return !highlightLinks.has(link) ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 128, 0, 1)';
        }}
        linkWidth={2}
        onLinkClick={(link) => {
          const selectedLink = graph.links.find((l: any) => l.index === link.index)
          onSelectedLink(selectedLink.body)
        }}
        onNodeClick={(node) => {
          setSelectedNode(node.address)
        }}
        onLinkHover={handleLinkHover}
        linkDirectionalParticles={1}
        // nodeAutoColorBy="address"
        linkDirectionalParticleWidth={link => highlightLinks.has(link) ? 2 : 0}
        graphData={data.data} 
        nodeLabel={node => `${node.address}`}
        onNodeDragEnd={node => {
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
        }}
        linkCurvature={link => {
          const sameSourceTargetLinks = graph.links.filter((l: any) => 
            (l.source === link.source && l.target === link.target) || 
            (l.source === link.target && l.target === link.source)
          );
          if (sameSourceTargetLinks.length > 1) {
            const index = sameSourceTargetLinks.findIndex((l: any) => l === link);
            return (index + 0.2) / sameSourceTargetLinks.length * 0.5;
          }
          return 0.2;
        }}        
      />
    )}
    </div>
  );  
};

export { Graph };