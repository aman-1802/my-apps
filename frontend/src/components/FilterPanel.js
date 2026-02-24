import { useState } from "react";
import { ChevronDown, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const PAYMENT_STATUSES = ['Paid', 'Partially Paid', 'Unpaid'];
const PAID_BY_OPTIONS = ['Me', 'Mom', 'Dad', 'Others'];
const CATEGORIES = ['Food', 'Rent', 'Subscriptions', 'Dinner', 'Blinkit', 'Travel', 'Utilities', 'Shopping', 'Other'];

const FilterPanel = ({ filters, onFilterChange, tags = [] }) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined && v !== null && v !== '').length;

  const handleClearFilters = () => {
    onFilterChange({
      month: undefined,
      year: undefined,
      category: undefined,
      payment_status: undefined,
      to_be_paid_by: undefined,
      is_fixed: undefined,
      tag: undefined
    });
  };

  const handleFilterChange = (key, value) => {
    onFilterChange({
      ...filters,
      [key]: value === 'all' ? undefined : value
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <div className="flex items-center justify-between px-1 mb-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            data-testid="filter-toggle"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground hover:text-destructive"
            data-testid="clear-filters"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-4">
          {/* Row 1: Month & Year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Month</label>
              <Select
                value={filters.month || 'all'}
                onValueChange={(v) => handleFilterChange('month', v)}
              >
                <SelectTrigger className="h-10 rounded-xl" data-testid="filter-month">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Year</label>
              <Select
                value={filters.year || 'all'}
                onValueChange={(v) => handleFilterChange('year', v)}
              >
                <SelectTrigger className="h-10 rounded-xl" data-testid="filter-year">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Category & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Category</label>
              <Select
                value={filters.category || 'all'}
                onValueChange={(v) => handleFilterChange('category', v)}
              >
                <SelectTrigger className="h-10 rounded-xl" data-testid="filter-category">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              <Select
                value={filters.payment_status || 'all'}
                onValueChange={(v) => handleFilterChange('payment_status', v)}
              >
                <SelectTrigger className="h-10 rounded-xl" data-testid="filter-status">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {PAYMENT_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Paid By & Fixed/Variable */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Paid By</label>
              <Select
                value={filters.to_be_paid_by || 'all'}
                onValueChange={(v) => handleFilterChange('to_be_paid_by', v)}
              >
                <SelectTrigger className="h-10 rounded-xl" data-testid="filter-paid-by">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Anyone</SelectItem>
                  {PAID_BY_OPTIONS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Type</label>
              <Select
                value={filters.is_fixed === true ? 'fixed' : filters.is_fixed === false ? 'variable' : 'all'}
                onValueChange={(v) => handleFilterChange('is_fixed', v === 'fixed' ? true : v === 'variable' ? false : undefined)}
              >
                <SelectTrigger className="h-10 rounded-xl" data-testid="filter-type">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleFilterChange('tag', filters.tag === tag ? undefined : tag)}
                    className={cn(
                      "filter-tag",
                      filters.tag === tag && "active"
                    )}
                    data-testid={`filter-tag-${tag}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default FilterPanel;
