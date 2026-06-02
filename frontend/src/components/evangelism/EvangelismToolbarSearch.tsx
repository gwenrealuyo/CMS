import type { ComponentProps } from "react";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";

export {
  EVANGELISM_BRANCH_SELECT_BASE_CLASS,
  EVANGELISM_BRANCH_SELECT_CLASS,
  EVANGELISM_BRANCH_SELECT_FULL_WIDTH_CLASS,
  EVANGELISM_BRANCH_SELECT_LOCKED_CLASS,
  TOOLBAR_BRANCH_SELECT_BASE_CLASS,
  TOOLBAR_BRANCH_SELECT_CLASS,
  TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS,
  TOOLBAR_BRANCH_SELECT_LOCKED_CLASS,
} from "@/src/lib/toolbarStyles";

export type EvangelismToolbarSearchProps = ComponentProps<typeof ToolbarSearch>;

export default ToolbarSearch;
