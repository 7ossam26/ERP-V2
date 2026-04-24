import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { auditService } from "../../services/auditService";
import { formatArabicDateTime } from "../../utils/formatters";

function JsonViewer({ title, payload }) {
  return (
    <div className="rounded-[20px] border border-border-light bg-background-light">
      <div className="border-b border-border-light px-4 py-3 text-sm font-bold text-text-light">
        {title}
      </div>
      <pre className="max-h-80 overflow-auto px-4 py-4 text-left text-xs leading-6 text-text-light">
        {JSON.stringify(payload || {}, null, 2)}
      </pre>
    </div>
  );
}

const AuditLogPage = () => {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    users: [],
    modules: [],
    actions: [],
  });
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    userId: "",
    module: "",
    action: "",
  });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [expandedId, setExpandedId] = useState(null);

  const fetchAuditData = async (nextPage = page, nextFilters = filters) => {
    setLoading(true);
    try {
      const response = await auditService.getLogs({
        ...nextFilters,
        page: nextPage,
        limit: 25,
      });
      setLogs(response.data || []);
      setMeta({
        total: response.total || 0,
        totalPages: response.totalPages || 1,
      });
      setPage(response.page || nextPage);
    } catch (error) {
      toast.error(error.message || "فشل تحميل سجل العمليات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [options, response] = await Promise.all([
          auditService.getFilters(),
          auditService.getLogs({ page: 1, limit: 25 }),
        ]);

        if (!cancelled) {
          setFilterOptions(options);
          setLogs(response.data || []);
          setMeta({
            total: response.total || 0,
            totalPages: response.totalPages || 1,
          });
          setPage(1);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message || "تعذر فتح صفحة السجل");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await auditService.exportLogs(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("تم تجهيز ملف Excel");
    } catch (error) {
      toast.error(error.message || "فشل تصدير ملف السجل");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-14">
      <Paper
        elevation={0}
        className="rounded-[28px] border border-border-light bg-surface-light p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Typography variant="h4" className="font-extrabold text-text-light">
              سجل المراجعة
            </Typography>
            <Typography variant="body2" className="mt-2 text-text-light/70">
              عرض فلترة، مقارنة قبل/بعد، وتصدير مباشر إلى Excel لأحداث النظام الحساسة.
            </Typography>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outlined"
              className="!rounded-2xl !border-border-light !px-5 !py-2.5 !font-bold !text-text-light"
              onClick={() => {
                const nextFilters = {
                  from: "",
                  to: "",
                  userId: "",
                  module: "",
                  action: "",
                };
                setFilters(nextFilters);
                fetchAuditData(1, nextFilters);
              }}>
              مسح الفلاتر
            </Button>
            <Button
              variant="contained"
              disableElevation
              className="!rounded-2xl !bg-primary !px-5 !py-2.5 !font-bold"
              onClick={handleExport}
              disabled={exporting}
              startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : null}>
              {exporting ? "جارٍ التصدير..." : "تصدير Excel"}
            </Button>
          </div>
        </div>
      </Paper>

      <Paper
        elevation={0}
        className="rounded-[28px] border border-border-light bg-surface-light p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <TextField
            type="date"
            label="من تاريخ"
            value={filters.from}
            onChange={(event) =>
              setFilters((current) => ({ ...current, from: event.target.value }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label="إلى تاريخ"
            value={filters.to}
            onChange={(event) =>
              setFilters((current) => ({ ...current, to: event.target.value }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="المستخدم"
            value={filters.userId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, userId: event.target.value }))
            }>
            <MenuItem value="">الكل</MenuItem>
            {filterOptions.users.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.name} ({user.username})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="الوحدة"
            value={filters.module}
            onChange={(event) =>
              setFilters((current) => ({ ...current, module: event.target.value }))
            }>
            <MenuItem value="">الكل</MenuItem>
            {filterOptions.modules.map((moduleName) => (
              <MenuItem key={moduleName} value={moduleName}>
                {moduleName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="الإجراء"
            value={filters.action}
            onChange={(event) =>
              setFilters((current) => ({ ...current, action: event.target.value }))
            }>
            <MenuItem value="">الكل</MenuItem>
            {filterOptions.actions.map((action) => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
          </TextField>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="contained"
            disableElevation
            className="!rounded-2xl !bg-primary !px-5 !py-2.5 !font-bold"
            onClick={() => fetchAuditData(1)}>
            تطبيق الفلاتر
          </Button>
        </div>
      </Paper>

      <Paper
        elevation={0}
        className="overflow-hidden rounded-[28px] border border-border-light bg-surface-light shadow-sm">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="flex items-center gap-3 rounded-2xl border border-border-light bg-background-light px-6 py-4">
              <CircularProgress size={24} />
              <span className="text-sm font-bold text-text-light">
                جارٍ تحميل السجل...
              </span>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <Alert severity="info" className="!rounded-2xl">
              لا توجد نتائج مطابقة للفلاتر الحالية.
            </Alert>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-right text-sm">
              <thead className="bg-background-light text-text-light">
                <tr>
                  <th className="px-5 py-4 font-bold">التاريخ</th>
                  <th className="px-5 py-4 font-bold">المستخدم</th>
                  <th className="px-5 py-4 font-bold">الوحدة</th>
                  <th className="px-5 py-4 font-bold">الإجراء</th>
                  <th className="px-5 py-4 font-bold">المعرف</th>
                  <th className="px-5 py-4 font-bold">الفرع</th>
                  <th className="px-5 py-4 font-bold">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="border-t border-border-light">
                        <td className="px-5 py-4 font-medium text-text-light/75">
                          {formatArabicDateTime(log.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-text-light">
                            {log.user?.name || "النظام"}
                          </div>
                          <div className="text-xs text-text-light/60">
                            {log.user?.username || "system"}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-text-light">{log.targetEntity}</td>
                        <td className="px-5 py-4">
                          <Chip
                            size="small"
                            label={log.action}
                            className="!bg-accent/45 !font-bold !text-text-light"
                          />
                        </td>
                        <td className="px-5 py-4 text-text-light/75">
                          {log.targetId || "—"}
                        </td>
                        <td className="px-5 py-4 text-text-light/75">
                          {log.branch?.name || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <Button
                            variant="text"
                            className="!rounded-2xl !font-bold !text-primary"
                            onClick={() =>
                              setExpandedId((current) => (current === log.id ? null : log.id))
                            }>
                            {isExpanded ? "إخفاء JSON" : "عرض قبل/بعد"}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-t border-border-light bg-background-light/60">
                          <td colSpan={7} className="px-5 py-5">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <JsonViewer title="Before" payload={log.oldValues} />
                              <JsonViewer title="After" payload={log.details} />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Paper>

      <div className="flex flex-col gap-3 rounded-[24px] border border-border-light bg-surface-light px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-text-light/70">
          إجمالي السجلات: <span className="font-bold text-text-light">{meta.total}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outlined"
            className="!rounded-2xl !border-border-light !font-bold !text-text-light"
            onClick={() => fetchAuditData(Math.max(page - 1, 1))}
            disabled={page <= 1}>
            السابق
          </Button>
          <div className="rounded-full bg-background-light px-4 py-2 text-sm font-bold text-text-light">
            صفحة {page} من {meta.totalPages}
          </div>
          <Button
            variant="outlined"
            className="!rounded-2xl !border-border-light !font-bold !text-text-light"
            onClick={() => fetchAuditData(Math.min(page + 1, meta.totalPages))}
            disabled={page >= meta.totalPages}>
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
