"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/src/components/ui/Card";
import {
  ANALYTICS_CHART_GRID_STROKE,
  ANALYTICS_CHART_HEIGHT_CLASS,
  ANALYTICS_CHART_TICK_SIZE,
  ANALYTICS_LEGEND_PROPS,
  analyticsChartColor,
} from "@/src/lib/analyticsTheme";
import type { NccLessonBreakdown } from "@/src/types/reports";

interface LessonProgressChartProps {
  lessons: NccLessonBreakdown[];
  loading?: boolean;
}

export default function LessonProgressChart({
  lessons,
  loading = false,
}: LessonProgressChartProps) {
  const chartData = lessons
    .filter((lesson) => lesson.total > 0)
    .map((lesson) => ({
      name: lesson.lesson_title,
      completed: lesson.completed,
      in_progress: lesson.in_progress,
    }));

  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };

  return (
    <Card title="Lesson Progress by Lesson">
      {loading ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading lesson progress...
        </div>
      ) : chartData.length === 0 ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          No lesson progress data for the selected scope.
        </div>
      ) : (
        <div className={`${ANALYTICS_CHART_HEIGHT_CLASS} w-full`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ANALYTICS_CHART_GRID_STROKE}
              />
              <XAxis
                dataKey="name"
                tick={tick}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={70}
              />
              <YAxis allowDecimals={false} tick={tick} />
              <Tooltip />
              <Legend {...ANALYTICS_LEGEND_PROPS} />
              <Bar
                dataKey="completed"
                name="Completed"
                fill={analyticsChartColor(2)}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="in_progress"
                name="In Progress"
                fill={analyticsChartColor(0)}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
