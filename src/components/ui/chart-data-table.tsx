interface ChartDataRow {
  label: string;
  value: string;
}

interface ChartDataTableProps {
  caption: string;
  labelHeader: string;
  valueHeader: string;
  rows: ChartDataRow[];
}

export function ChartDataTable({ caption, labelHeader, valueHeader, rows }: ChartDataTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{labelHeader}</th>
          <th scope="col">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.label}-${index}`}>
            <td>{row.label}</td>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
