/**
 * 指定日の搬入計画を集約して工事名リストを返す
 *
 * @param {Array<{ projectId: string, deliveryDate: string }>} plans
 * @param {Record<string, string>} projectsMap - { [projectId]: projectName }
 * @returns {{ projectNames: string[] }}
 *
 * @example
 * summarizeCalendarDay(
 *   [{ projectId: 'p1', deliveryDate: '2026-03-11' }],
 *   { p1: '工事A' }
 * )
 * // => { projectNames: ['工事A'] }
 */
export function summarizeCalendarDay(plans, projectsMap) {
  const projectNames = plans
    .map(p => projectsMap[p.projectId] || '工事')
    .filter(Boolean);
  return { projectNames };
}
