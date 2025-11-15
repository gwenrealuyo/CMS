import Card from "@/src/components/ui/Card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Week 1", attendance: 150, giving: 2500 },
  { name: "Week 2", attendance: 165, giving: 3000 },
  { name: "Week 3", attendance: 180, giving: 2800 },
  { name: "Week 4", attendance: 172, giving: 3200 },
];

export default function MetricsChart() {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
        Monthly Overview
      </h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="attendance"
              stroke="#2563EB"
            />
            <Line yAxisId="right" type="monotone" dataKey="giving" stroke="#4A5568" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
