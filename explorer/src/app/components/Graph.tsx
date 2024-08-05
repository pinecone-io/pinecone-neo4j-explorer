// 'use client'
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { infer } from '@/app/actions/infer';
import { readStreamableValue } from 'ai/rsc';
import { useAppContext } from '../AppContext';

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

const fetchInferredData = async (nodes: any, edges: any) => {
  const response = await fetch('/api/infer', {
    method: 'POST',
    body: JSON.stringify({ nodes, edges }),
  });
  return response.json();
}
const Graph = () => {
  const {
    selectedData,
    setSelectedLink,
    setHoveredLink,
    setHoveredNode,
    summary,    
    setInferredData
  } = useAppContext();

  const [localSelectedNodes, setLocalSelectedNodes] = useState<string[] | null | undefined>(null);
  const [selectedNode, setSelectedNode] = useState<string | null | undefined>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['graphData', localSelectedNodes],
    queryFn: () => localSelectedNodes && fetchGraphData(localSelectedNodes),
    enabled: false,
  });

  const [graph, setGraph] = useState<any>(null);

  useEffect(() => {
    console.log(data)
    const getInferredData = async () => {
      const result = await infer({nodes: data.data.nodes, edges: data.data.links, summary})
      const object = result?.object;
      

      if (object) {
        for await (const partialObject of readStreamableValue(object)) {
            if (partialObject) {              
              setInferredData(partialObject);
            }
        }
      }        
    }
    if (data) {
      getInferredData()
    }
  }, [data, summary, setInferredData]);

  useEffect(() => {
    if (selectedData.nodes) {
      setLocalSelectedNodes(selectedData.nodes);
    }
  }, [selectedData.nodes]);

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
    // highlightNodes.clear();
    
    // if (link) {
    //   highlightLinks.clear();
    //   highlightLinks.add(link);
    //   highlightNodes.add(link.source);
    //   highlightNodes.add(link.target);
    //   setHoveredLink(link ? link.body : '');
    //   updateHighlight();
    // }
  };

  const handleNodeHover = (node: any) => {
    if (node){
      const { label,  id, caseId } = node
      if (label === "Case") {
        console.log(label, caseId)
        setHoveredNode(caseId)
      }
    }
  }

  const fgRef = useRef();

  if (isLoading) return 'Loading...';
  if (error) return `An error has occurred: ${error.message}`;
  
  

  return (
    <div>
      
    {data && (
      <ForceGraph2D 

        ref={fgRef}
        // width={600}
        height={1000}
        onEngineStop={() => (fgRef.current as any)?.zoomToFit(600)}
        onDagError={(e) => console.error(e)}
        
        // linkColor={(link) => {
        //   if (selectedTransactions && selectedTransactions.includes(link.transaction_id)) {
        //     return !highlightLinks.has(link) ? 'rgba(255, 165, 0, 1)' : 'orange';
        //   }
        //   return !highlightLinks.has(link) ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 128, 0, 1)';
        // }}
        // linkWidth={2}
        // linkLabel={link => {
        //   console.log(link)
        //   return link.label
        // }} // Add this line to set the link label
        // linkDirectionalArrowRelPos={1} // Position the label along the curvature
        linkDirectionalArrowLength={0} // Set arrow length
        
        linkCanvasObject={(link, ctx, globalScale) => {          
          const BASE_FONT_SIZE = 2; // Base font size
          const MIN_FONT_SIZE = 1; // Maximum font size for large scale
          const MAX_FONT_SIZE = 2;

          const LABEL_NODE_MARGIN = 2; // Margin between the label and the node
          // const fontSize = globalScale <= 8 ? BASE_FONT_SIZE * (globalScale / 8): Math.min(BASE_FONT_SIZE * (globalScale / 8), MIN_FONT_SIZE);
          const fontSize = Math.min(Math.max(BASE_FONT_SIZE * (globalScale / 8), MIN_FONT_SIZE), MAX_FONT_SIZE);

          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = 'rgba(211, 211, 211, 1)'; // Light gray color for text

          const start = link.source;
          const end = link.target;
          if (!start || !end) return;

          const isValidPoint = (point: any): point is { x: number; y: number } =>
            typeof point === 'object' && point !== null && 'x' in point && 'y' in point &&
            typeof point.x === 'number' && typeof point.y === 'number';

          const getCoordinate = (point: any, coord: 'x' | 'y'): number =>
            isValidPoint(point) ? point[coord] : 0;

          // Draw the link
          if (isValidPoint(start) && isValidPoint(end)) {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = 'rgba(211, 211, 211, 1)'; // Light gray color for links
            ctx.lineWidth = 0.2; // Set link width to 0.2px
            ctx.stroke();
          }

          // Draw the arrow
          const arrowLength = 1.5; // Smaller arrow length
          const arrowWidth = 0.2; // Thinner arrow width
          const headlen = arrowLength; // length of head in pixels
          const dx = getCoordinate(end, 'x') - getCoordinate(start, 'x');
          const dy = getCoordinate(end, 'y') - getCoordinate(start, 'y');
          const angle = Math.atan2(dy, dx);

          const nodeRadius = 5; // Adjust this value based on your node size
          const arrowStartX = getCoordinate(end, 'x') - nodeRadius * Math.cos(angle);
          const arrowStartY = getCoordinate(end, 'y') - nodeRadius * Math.sin(angle);

          ctx.beginPath();
          ctx.moveTo(arrowStartX, arrowStartY);
          ctx.lineTo(arrowStartX - headlen * Math.cos(angle - Math.PI / 6), arrowStartY - headlen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(arrowStartX, arrowStartY);
          ctx.lineTo(arrowStartX - headlen * Math.cos(angle + Math.PI / 6), arrowStartY - headlen * Math.sin(angle + Math.PI / 6));
          ctx.strokeStyle = 'rgba(211, 211, 211, 1)'; // Light gray color for arrows
          ctx.lineWidth = arrowWidth; // Thinner arrow width
          ctx.stroke();
          
          // Calculate the midpoint of the link
          const midX = (getCoordinate(start, 'x') + getCoordinate(end, 'x')) / 2;
          const midY = (getCoordinate(start, 'y') + getCoordinate(end, 'y')) / 2;

          // Calculate the angle of the link
          const textAngle = Math.atan2(
            getCoordinate(end, 'y') - getCoordinate(start, 'y'),
            getCoordinate(end, 'x') - getCoordinate(start, 'x')
          );

          // Save the current context state
          ctx.save();

          // Translate to the midpoint and rotate the context
          ctx.translate(midX, midY);
          ctx.rotate(textAngle);

          // Flip the text if the angle is greater than 180 degrees
          if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
            ctx.rotate(Math.PI);
          }

          // Draw the label
          ctx.fillText(link.label, 0, -LABEL_NODE_MARGIN);

          // Restore the context to its original state
          ctx.restore();
        }}

        onLinkClick={(link) => {
          // const selectedLink = graph.links.find((l: any) => l.index === link.index)
          // setSelectedLink(selectedLink.body)
        }}
        onNodeClick={(node) => {
          setSelectedNode(node.address)
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {          
          const BASE_FONT_SIZE = 2; // Base font size for small scale
          const MAX_FONT_SIZE = 2; // Maximum font size for large scale
          const fontSize = Math.min(BASE_FONT_SIZE * (globalScale / 18), MAX_FONT_SIZE);
          
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Define a color mapping function based on the node label
          const getColorFromLabel = (label: string) => {
            // Example color mapping function
            const colors = {
              'Case': '#FF5733', // Red
              'Justice': '#33FF57', // Green
              'Advocate': '#3357FF', // Blue
              'ORG': '#FF33A1', // Pink
              'PER': '#33FFA1', // Light Green
              'MISC': '#A133FF', // Purple
              'Opinion': '#FFA133', // Orange
              'LOC': '#33A1FF', // Light Blue
              'Party': '#A1FF33', // Lime Green
              } as { [key: string]: string };
            return colors[label] || '#000000'; // Default to black if label not found
          };

          const fillColor = getColorFromLabel(node.label);

          // Draw the node circle
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, 5, 0, 2 * Math.PI, false); // Adjust the radius as needed
          ctx.fillStyle = fillColor;
          ctx.fill();

          // Function to wrap text within a given width
          const wrapText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
            const words = text.split(' ');
            let line = '';
            let lineY = y;
            for (let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' ';
              const metrics = ctx.measureText(testLine);
              const testWidth = metrics.width;
              if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, lineY);
                line = words[n] + ' ';
                lineY += lineHeight;
              } else {
                line = testLine;
              }
            }
            ctx.fillText(line, x, lineY);
          };

          // Draw the node text in the middle of the node
          ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // Black color for text
          const text = node.name ?? node.title ?? "";
          wrapText(text, node.x ?? 0, node.y ?? 0, 10, fontSize); // Adjust maxWidth and lineHeight as needed

          // Draw the node label in smaller font below the node text
          ctx.font = `${fontSize * 0.5}px Sans-Serif`; // Smaller font size for label
          wrapText(node.label, node.x ?? 0, (node.y ?? 0) + 6, 10, fontSize * 0.5); // Adjust maxWidth and lineHeight as needed
        }}
        onLinkHover={handleLinkHover}
        onNodeHover={handleNodeHover}
        linkDirectionalParticles={1}
        nodeAutoColorBy="label"
        linkDirectionalParticleWidth={link => highlightLinks.has(link) ? 2 : 0}
        graphData={data.data} 
        nodeLabel={node => `${node.label}`}
        onNodeDragEnd={node => {
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
        }}
        // linkCurvature={link => {
        //   const sameSourceTargetLinks = graph.links.filter((l: any) => 
        //     (l.source === link.source && l.target === link.target) || 
        //     (l.source === link.target && l.target === link.source)
        //   );
        //   if (sameSourceTargetLinks.length > 1) {
        //     const index = sameSourceTargetLinks.findIndex((l: any) => l === link);
        //     return (index + 0.2) / sameSourceTargetLinks.length * 0.5;
        //   }
        //   return 0.2;
        // }}        
      />
    )}

    </div>
  );  
};

export { Graph };