'use client'
import { useCallback, useState } from "react";
import { Graph } from "./Graph";
import { Search } from "./Search";
import { CypherResults } from "@/components/CypherResults";
import { Questions } from "@/components/Questions";
import { useAppContext } from "../AppContext";
import { Button } from "@material-tailwind/react";
import { IconButton } from "@material-tailwind/react";
import { PiGraphBold } from "react-icons/pi";
import { BsFileText } from "react-icons/bs";
import { SearchInput } from "./SearchInput";
import Image from "next/image";

export default function Home() {
  const { isFlipped, setIsFlipped, cypherQueryResult } = useAppContext();

  return (
     <div>
      <div className="h-screen bg-white text-sm">
        <div className="sticky top-0 z-10 box-border pb-15 pl-5 text-3xl h-[75px] bg-white flex items-center">
          
          <div className="flex justify-start text-black">
            <Image src="/pinecone.svg" width={140} height={140} className="mr-2" alt="logo"></Image> <div className="text-2xl mt-2">Graph Explorer</div>
          </div>
          <div className="flex ml-auto mr-3">
            <IconButton variant="outlined" className="rounded-full" onClick={() => setIsFlipped(!isFlipped)} >              
              {isFlipped ? <BsFileText /> : <PiGraphBold />            
            }
            </IconButton>
          </div>
        </div>
        <div className="flex justify-center p-4 bg-gray-100 pt-5">
          <div className="flex mx-auto w-[70vw]">
            <SearchInput />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 bg-gray-100 h-[calc(100vh-135px)] overflow-hidden">
          <div className="flex flex-col h-full overflow-auto">
            <div className="box-border flex relative flex-col grow shrink-0 h-full ml-5">
              <Search />
            </div>
          </div>
          <div className={`flip-card ${isFlipped ? 'flipped' : ''} h-full overflow-auto`}>
            <div className="flip-card-inner h-full">
              <div className="flip-card-front grid grid-rows-[1fr_auto] overflow-auto">
                <div className="overflow-auto">
                  <Questions />
                </div>
                {cypherQueryResult && 
                  <div className="bg-gray-100 overflow-y-auto">
                    <CypherResults />
                  </div>
                }
              </div>
              <div className="flip-card-back h-full overflow-auto">
                <div className="box-border flex relative flex-col grow shrink-0 mt-1 h-full">
                  <Graph />
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
     </div>
  );
}