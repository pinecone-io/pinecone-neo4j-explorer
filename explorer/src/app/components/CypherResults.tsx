import { JsonToTable } from "react-json-to-table";
import { useAppContext } from "../AppContext";

const CypherResults = () => {

  const { cypherQueryResult } = useAppContext();
  return (
    <div className="box-border flex relative flex-col grow shrink-0 rounded-lg overflow-y-scroll bg-white text-black mr-2 p-4 h-full">
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
  )
}

export { CypherResults };