/**
 * Some models still print their reasoning inline when thinking can't be turned
 * off. Drop those blocks so JSON extraction and tutor answers see only the
 * reply.
 */
export function stripReasoning(raw: string): string {
  return raw
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
}
