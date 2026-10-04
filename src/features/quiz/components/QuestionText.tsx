// Preserve authored paragraph breaks without changing existing single-line markup.
export function QuestionText({text}: {text: string}) {
  return text.includes('\n')
    ? <span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{text}</span>
    : <>{text}</>;
}
