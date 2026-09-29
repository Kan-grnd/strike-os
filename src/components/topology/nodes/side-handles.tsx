import { Handle, Position } from "@xyflow/react";
import { HANDLE_IDS } from "@/lib/runtime/selectors";

/**
 * Lateral handle anchors, invisible.
 *
 * Ownership in this graph is a tree, so every parent→child edge is downward and
 * uses the top/bottom pair. These exist for the edges that are *not* downward:
 * a delegation or verification that crosses from one territory to another lands
 * on a card in the same row, and one that reaches back up to a higher level has
 * to come in from the side. React Flow only lets an edge name a handle, and it
 * routes from whichever handle the edge names, so those need a real handle on
 * the side — otherwise they exit the bottom of the sender, loop under the row
 * and climb back into the target's top, which reads as a reporting line the
 * event never claimed.
 *
 * They are invisible because the top/bottom pair is the visible language of
 * this graph: four more dots per card would add fifteen dots per pane of pure
 * noise while carrying no information a user acts on.
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
