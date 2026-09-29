import { Handle, Position } from "@xyflow/react";
import { HANDLE_IDS } from "@/lib/runtime/selectors";

/**
 * Lateral handle anchors, invisible.
 *
 * The hub layout puts a territory beside the brain, so a brain→territory edge
 * has to leave a card sideways. React Flow only lets an edge name a handle, and
 * it routes from whichever handle the edge names, so a sideways neighbour needs
 * a real handle on the side — otherwise the edge exits the bottom of the brain
 * and re-enters the top of the territory, which reads as a detour rather than a
 * spoke.
 *
 * They are invisible because the top/bottom pair is already the visible
 * language of this graph: four more dots per card would add fifteen dots per
 * pane of pure noise while carrying no information a user acts on.
 */
export function SideHandles({ target = false, source = false }: { target?: boolean; source?: boolean }) {
  return (
    <>
      {target ? (
        <>
          <Handle type="target" position={Position.Left} id={HANDLE_IDS.inLeft} className="opacity-0" />
          <Handle type="target" position={Position.Right} id={HANDLE_IDS.inRight} className="opacity-0" />
        </>
      ) : null}
      {source ? (
        <>
          <Handle type="source" position={Position.Left} id={HANDLE_IDS.outLeft} className="opacity-0" />
          <Handle type="source" position={Position.Right} id={HANDLE_IDS.outRight} className="opacity-0" />
        </>
      ) : null}
    </>
  );
}
