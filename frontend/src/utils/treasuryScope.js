/**
 * Narrow a treasury list to the branches the operator may post to.
 *
 * The empty-`userBranches` case is deliberately closed rather than open: before
 * BranchContext resolves the signed-in user there are no allowed branches yet,
 * and returning the full list there would offer another branch's treasury and
 * auto-select it as the default. Callers should treat an empty result as "still
 * resolving" and keep the operator from submitting.
 *
 * @param {Array} treasuries - raw list from treasuryService.getAll()
 * @param {Array} userBranches - branches from useBranch()
 * @returns {Array} active treasuries belonging to an allowed branch (or to none)
 */
export const scopeTreasuriesToBranches = (treasuries, userBranches) => {
  const list = Array.isArray(treasuries) ? treasuries : [];
  const allowedBranchIds = new Set((userBranches || []).map((b) => b.id));
  if (allowedBranchIds.size === 0) return [];

  return list.filter(
    (t) => t.isActive !== false && (!t.branch || allowedBranchIds.has(t.branch.id)),
  );
};

export default scopeTreasuriesToBranches;
