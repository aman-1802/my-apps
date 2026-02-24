import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getCategoryBreakdown, getMonthlyTrend, getFixedVsVariable, getAnalyticsSummary } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_COLORS = {
  light: ['#0F766E', '#0EA5E9', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],
  dark: ['#2DD4BF', '#38BDF8', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#5EEAD4', '#FB923C']
};

const Analytics = () => {
  const { isDark } = useTheme();
  const [categoryData, setCategoryData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [fixedVsVariable, setFixedVsVariable] = useState({ fixed: 0, variable: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [categoryBreakdown, trend, fixedVar, summary] = await Promise.all([
          getCategoryBreakdown(),
          getMonthlyTrend(6),
          getFixedVsVariable(),
          getAnalyticsSummary()
        ]);

        // Transform category data for pie chart
        const catData = Object.entries(categoryBreakdown).map(([name, data]) => ({
          name,
          value: data.total,
          paid: data.paid,
          unpaid: data.unpaid
        })).filter(d => d.value > 0);
        setCategoryData(catData);

        // Transform monthly data for line chart
        const monthData = Object.entries(trend).map(([month, data]) => ({
          month: month.slice(5), // Get MM from YYYY-MM
          total: data.total,
          paid: data.paid,
          unpaid: data.unpaid
        })).reverse();
        setMonthlyData(monthData);

        setFixedVsVariable(fixedVar);
        setAnalytics(summary);
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const paidVsUnpaidData = analytics ? [
    { name: 'Paid', value: analytics.total_paid || 0 },
    { name: 'Unpaid', value: analytics.total_unpaid || 0 }
  ] : [];

  const fixedVsVariableData = [
    { name: 'Fixed', value: fixedVsVariable?.fixed?.total || 0 },
    { name: 'Variable', value: fixedVsVariable?.variable?.total || 0 }
  ];

  const getTrendIcon = (direction) => {
    if (direction === 'down') return <TrendingDown className="w-5 h-5 text-green-500" />;
    if (direction === 'up') return <TrendingUp className="w-5 h-5 text-red-500" />;
    return <Minus className="w-5 h-5 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-2xl p-4 border border-border/50 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded mb-4" />
            <div className="h-48 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-6" data-testid="analytics-page">
      {/* Financial Overview */}
      <div className="bg-card rounded-2xl p-5 border border-border/50">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Financial Overview
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Expense</p>
            <p className="text-2xl font-bold">₹{analytics?.total_expense?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">This Month</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">₹{analytics?.current_month_expense?.toLocaleString() || 0}</p>
              {getTrendIcon(analytics?.trend_direction)}
            </div>
            {analytics?.trend_percentage !== 0 && (
              <p className={cn(
                "text-xs",
                analytics?.trend_direction === 'down' ? 'text-green-500' : 'text-red-500'
              )}>
                {Math.abs(analytics?.trend_percentage)}% vs last month
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Category Distribution - Pie Chart */}
      {categoryData.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Category Distribution
          </h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Trend - Line Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Monthly Trend
          </h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272A' : '#E2E8F0'} />
                <XAxis 
                  dataKey="month" 
                  stroke={isDark ? '#9CA3AF' : '#64748B'}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke={isDark ? '#9CA3AF' : '#64748B'}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke={colors[0]} 
                  strokeWidth={2}
                  dot={{ fill: colors[0], strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Paid vs Unpaid - Bar Chart */}
      <div className="bg-card rounded-2xl p-5 border border-border/50">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Paid vs Unpaid
        </h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paidVsUnpaidData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272A' : '#E2E8F0'} />
              <XAxis 
                type="number" 
                stroke={isDark ? '#9CA3AF' : '#64748B'}
                tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke={isDark ? '#9CA3AF' : '#64748B'}
                width={60}
              />
              <Tooltip 
                formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']}
                contentStyle={{
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {paidVsUnpaidData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? (isDark ? '#34D399' : '#059669') : (isDark ? '#F87171' : '#DC2626')} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fixed vs Variable - Bar Chart */}
      <div className="bg-card rounded-2xl p-5 border border-border/50">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Fixed vs Variable
        </h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fixedVsVariableData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272A' : '#E2E8F0'} />
              <XAxis 
                dataKey="name" 
                stroke={isDark ? '#9CA3AF' : '#64748B'}
              />
              <YAxis 
                stroke={isDark ? '#9CA3AF' : '#64748B'}
                tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']}
                contentStyle={{
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {fixedVsVariableData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
