import { matrixFooter } from '@/server/diagnosis/domain/matrix-footer'
import type { Answers, MatrixAnswer, Question } from '@/server/diagnosis/domain/question-types'

export function MatrixField({ question, answers, onChange }: { question: Question; answers: Answers; onChange(row: string, value: string): void }) {
  const matrix = (answers[question.key] as MatrixAnswer | undefined) ?? {}
  const columns = question.columns ?? []
  const footer = matrixFooter(answers, question.key)
  const unknown = (value: string) => (value === question.unknownValue ? 'is-unknown' : undefined)
  return (
    <>
      <div className="dx-matrix-scroll">
        <table className="dx-matrix">
          <thead>
            <tr>
              <th />
              {columns.map((column) => (
                <th key={column.value} scope="col" className={unknown(column.value)}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(question.rows ?? []).map((row) => (
              <tr key={row.key}>
                <th scope="row" className="dx-matrix-row">
                  {row.label}
                </th>
                {columns.map((column) => (
                  <td key={column.value} className={unknown(column.value)}>
                    <label>
                      <input
                        type="radio"
                        name={`${question.key}__${row.key}`}
                        value={column.value}
                        checked={matrix[row.key] === column.value}
                        aria-label={`${row.label}: ${column.label}`}
                        onChange={() => onChange(row.key, column.value)}
                      />
                      <span className="dx-matrix-band">{column.label}</span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={footer.warning ? 'dx-matrix-sum is-warning' : 'dx-matrix-sum'}>{footer.text}</div>
    </>
  )
}
