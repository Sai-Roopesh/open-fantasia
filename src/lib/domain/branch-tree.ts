import type { BranchTreeNode, ChatBranchRecord } from "@/lib/types";

/**
 * Builds the git-style branch tree from the flat branch list. Each branch
 * becomes a node whose children are the branches forked from it
 * (parent_branch_id). Roots are branches with no parent (typically "Main").
 *
 * Pure. Orphan branches whose parent is missing are reattached at the root so
 * nothing is silently dropped. Children and roots are ordered by creation time
 * (with id as a stable tiebreaker) for deterministic rendering.
 */
export function buildBranchTree(branches: ChatBranchRecord[]): BranchTreeNode[] {
  const nodes = new Map<string, BranchTreeNode>();
  for (const branch of branches) {
    nodes.set(branch.id, {
      id: branch.id,
      name: branch.name,
      parentBranchId: branch.parent_branch_id,
      forkTurnId: branch.fork_turn_id,
      headTurnId: branch.head_turn_id,
      isActive: branch.is_active,
      createdAt: branch.created_at,
      children: [],
    });
  }

  const roots: BranchTreeNode[] = [];
  for (const branch of branches) {
    const node = nodes.get(branch.id)!;
    const parent = branch.parent_branch_id ? nodes.get(branch.parent_branch_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const byCreated = (a: BranchTreeNode, b: BranchTreeNode) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);

  const sortRecursive = (list: BranchTreeNode[]) => {
    list.sort(byCreated);
    for (const node of list) sortRecursive(node.children);
  };
  sortRecursive(roots);

  return roots;
}
