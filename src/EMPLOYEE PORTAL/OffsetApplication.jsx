import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { Calendar } from "lucide-react";

import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { toast } from "sonner";

import clsx from "clsx";
import { twMerge } from "tailwind-merge";
const cn = (...inputs) => twMerge(clsx(inputs));

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ===========================================================
   CONSTANTS + SMALL REUSABLE HELPERS
=========================================================== */

const BRAND_BLUE = "bg-[#1e40ae] hover:bg-[#1e3a8a]";

const formSchema = z.object({
  offsetDate: z.string().min(1, "Offset Date is required"),
  offsetType: z.enum(["Opening", "Closing"]),
  offsetHours: z.coerce.number().positive("Hours must be greater than 0"),
  remarks: z.string().trim().min(1, "Remarks is required"),
});

const badgeClass = (status) => {
  const base =
    "inline-flex justify-center items-center text-xs w-24 py-1 rounded-lg font-semibold";
  switch ((status || "").toLowerCase()) {
    case "approved":
      return `${base} bg-blue-100 text-blue-700`;
    case "disapproved":
      return `${base} bg-red-100 text-red-700`;
    case "pending":
      return `${base} bg-amber-100 text-amber-700`;
    case "cancelled":
    case "canceled":
      return `${base} bg-gray-200 text-gray-700`;
    default:
      return `${base} bg-slate-100 text-slate-700`;
  }
};

const StatusBadge = ({ status }) => (
  <span className={badgeClass(status)}>{status || "N/A"}</span>
);

const fmtDate = (d) => (d ? dayjs(d).format("MM/DD/YYYY") : "—");

/** Calendar icon date input */
const DateInput = ({ id, value, onChange, min, disabled, className = "" }) => {
  const openPicker = () => {
    const el = document.getElementById(id);
    el?.showPicker?.(); // Chrome/Edge
    el?.focus?.(); // fallback
  };

  return (
    <div className="relative">
      <Calendar
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 cursor-pointer"
        onClick={openPicker}
      />
      <Input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        min={min}
        disabled={disabled}
        className={cn("pl-9", className)}
        onClick={(e) => e.currentTarget.showPicker?.()}
      />
    </div>
  );
};

const ViewToggle = ({ viewMode, setViewMode }) => (
  <div className="inline-flex rounded-lg border overflow-hidden self-start">
    {["card", "accordion", "table"].map((v, idx) => (
      <button
        key={v}
        className={cn(
          "px-8 py-2 text-sm",
          idx !== 0 && "border-l",
          viewMode === v ? "bg-blue-800 text-white" : "bg-white",
        )}
        onClick={() => setViewMode(v)}
        type="button"
      >
        {v[0].toUpperCase() + v.slice(1)}
      </button>
    ))}
  </div>
);

const PendingCancelButton = ({ entry, onCancel, isBusy }) => {
  if (entry?.offsetStatus !== "Pending") return <span>—</span>;
  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={() => onCancel(entry)}
      disabled={isBusy}
    >
      {isBusy ? "Cancelling..." : "Cancel"}
    </Button>
  );
};

/* ===========================================================
   MAIN
=========================================================== */

const OffsetApplication = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // DTR range (computed once per mount; good enough for "current month")
  const startDate = useMemo(
    () => dayjs().startOf("month").format("YYYY-MM-DD"),
    [],
  );
  const endDate = useMemo(
    () => dayjs().endOf("month").format("YYYY-MM-DD"),
    [],
  );

  // Filter: Timekeeping
  const [tkDateFrom, setTkDateFrom] = useState(
    dayjs().subtract(14, "day").format("YYYY-MM-DD"),
  );
  const [tkDateTo, setTkDateTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [recordFrom, setRecordFrom] = useState("All"); // All | Opening | Closing

  // Filter: History (default = 2 weeks)
  const [historyDateFrom, setHistoryDateFrom] = useState(
    dayjs().subtract(14, "day").format("YYYY-MM-DD"),
  );
  const [historyDateTo, setHistoryDateTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyOffsetType, setHistoryOffsetType] = useState("");

  // Selection + view
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewMode, setViewMode] = useState("card");

  // Confirm dialogs
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [pendingCancelEntry, setPendingCancelEntry] = useState(null);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState(null);

  // Form
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      offsetDate: dayjs().format("YYYY-MM-DD"),
      offsetType: "Opening",
      offsetHours: "",
      remarks: "",
    },
    mode: "onSubmit",
  });

  const offsetType = form.watch("offsetType");
  const offsetHours = form.watch("offsetHours");

  /* =========================
      QUERIES
  ========================= */

  const {
    data: dtrRecords = [],
    isLoading: dtrLoading,
    isFetching: dtrFetching,
    isError: dtrError,
    error: dtrErrorObj,
  } = useQuery({
    queryKey: ["dtrRecords", user?.empNo, startDate, endDate],
    enabled: !!user?.empNo,
    queryFn: async () => {
  const res = await axios.get(
    `${API_ENDPOINTS.getDTROffset}/${user.empNo}/${startDate}/${endDate}`
  );
  console.log("getDTROffset response:", res.data);
  return res.data?.records || [];
},
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const {
    data: offsetApplications = [],
    isLoading: historyLoading,
    isFetching: historyFetching,
    isError: historyError,
    error: historyErrorObj,
    dataUpdatedAt: historyUpdatedAt,
  } = useQuery({
    queryKey: ["offsetHistory", user?.empNo, historyDateFrom, historyDateTo],
    enabled: !!user?.empNo,
    queryFn: async () => {
      const res = await axios.post(API_ENDPOINTS.getOffsetAppHistory, {
        EMP_NO: user.empNo,
        START_DATE: historyDateFrom, // ✅ simplified
        END_DATE: historyDateTo, // ✅ simplified
      });

      return (res.data?.data || []).map((r, index) => ({
        id: index + 1,
        offsetDate: r.offsetDate,
        sourceDate: r.sourceDate,
        offsetHours: Number(r.offsetHrs || 0),
        offsetType: r.offsetType,
        remarks: r.offsetRemarks,
        offsetStatus: r.offsetStatus,
        offsetStamp: r.offsetStamp,
        approverRemarks: r.approverRemarks || null,
      }));
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const loading = dtrLoading || historyLoading;
  const syncing = dtrFetching || historyFetching;

  // If approvals/history changes -> refresh DTR silently
  useEffect(() => {
    if (!user?.empNo) return;
    queryClient.invalidateQueries({
      queryKey: ["dtrRecords", user?.empNo, startDate, endDate],
    });
  }, [historyUpdatedAt, user?.empNo, startDate, endDate, queryClient]);

  /* =========================
      MAP + FILTER TIMEKEEPING
  ========================= */

  const timekeepingRecords = useMemo(() => {
    if (!Array.isArray(dtrRecords)) return [];
    return dtrRecords.map((r, index) => ({
      id: index + 1,
      date: dayjs(r.date).format("YYYY-MM-DD"),
      timeIn: r.time_in ? dayjs(r.time_in).format("hh:mm A") : "—",
      timeOut: r.time_out ? dayjs(r.time_out).format("hh:mm A") : "—",
      totalHours: Number(r.worked_hrs || 0),
      totalOT: Number(r.total_ot_hours || 0),
      openingHours: Number(r.ot_before_shift || 0),
      closingHours: Number(r.ot_after_shift || 0),
      appliedBeforeShift: Number(r.applied_before_shift || 0),
      appliedAfterShift: Number(r.applied_after_shift || 0),
      totalApplied: Number(r.total_applied_hrs || 0),
      remainingHours: Number(r.remaining_hrs || 0),
    }));
  }, [dtrRecords]);

  const validOffsetRecords = useMemo(() => {
    const cutoffDate = dayjs().subtract(14, "day");
    return timekeepingRecords.filter((r) => {
      const recordDate = dayjs(r.date);
      if (recordDate.isBefore(cutoffDate, "day")) return false;
      if (tkDateFrom && recordDate.isBefore(dayjs(tkDateFrom), "day")) return false;
      if (tkDateTo && recordDate.isAfter(dayjs(tkDateTo), "day")) return false;
      return true;
    });
  }, [timekeepingRecords, tkDateFrom, tkDateTo]);

  /* =========================
      BALANCE HELPERS
  ========================= */

  const getRemainingBalance = (row) => {
    if (!row) return 0;
    if (offsetType === "Opening") {
      return Math.max(
        Number(row.openingHours) - Number(row.appliedBeforeShift),
        0,
      );
    }
    if (offsetType === "Closing") {
      return Math.max(
        Number(row.closingHours) - Number(row.appliedAfterShift),
        0,
      );
    }
    return Number(row.remainingHours || 0);
  };

  const computedRemainingBalance = useMemo(() => {
    if (!selectedRecord) return 0;
    const available = getRemainingBalance(selectedRecord);
    const entered = Number(offsetHours || 0);
    const remaining = available - entered;
    return remaining > 0 ? Number(remaining.toFixed(2)) : 0;
  }, [selectedRecord, offsetHours, offsetType]);

  /* =========================
      SELECT RECORD
  ========================= */

  const handleSelectRecord = (row) => {
    if (selectedRecord?.id === row.id) {
      setSelectedRecord(null);
      form.reset({
        offsetDate: dayjs().format("YYYY-MM-DD"),
        offsetType: form.getValues("offsetType"),
        offsetHours: "",
        remarks: "",
      });
      return;
    }

    setSelectedRecord(row);
    form.setValue("offsetHours", "");
    form.setValue("remarks", `Offset from overtime on ${fmtDate(row.date)}`);
  };

  /* =========================
      MUTATIONS
  ========================= */

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["offsetHistory"] }),
      queryClient.invalidateQueries({ queryKey: ["dtrRecords"] }),
    ]);
  };

  const submitMutation = useMutation({
  mutationFn: async (payload) => {
    const res = await axios.post(API_ENDPOINTS.upsertOffset, payload);
    const data = res?.data;

    console.log("upsertOffset response:", data);

    const firstRow =
      Array.isArray(data?.data) && data.data.length > 0
        ? data.data[0]
        : Array.isArray(data) && data.length > 0
          ? data[0]
          : null;

    const rawSproc =
      firstRow?.[""] ??
      firstRow?.result ??
      firstRow?.Result ??
      firstRow?.message ??
      firstRow?.Message;

    let sprocParsed = null;
    if (typeof rawSproc === "string") {
      try {
        sprocParsed = JSON.parse(rawSproc);
      } catch {
        sprocParsed = null;
      }
    }

    const finalOk =
      data?.success === true ||
      data?.success === 1 ||
      data?.success === "1" ||
      data?.status === "success" ||
      data?.status === "SUCCESS" ||
      data?.status === 1 ||
      data?.status === "1" ||
      sprocParsed?.result === "1" ||
      sprocParsed?.result === 1 ||
      sprocParsed?.success === true ||
      sprocParsed?.success === 1 ||
      sprocParsed?.success === "1" ||
      sprocParsed?.status === "success" ||
      sprocParsed?.status === "SUCCESS";

    if (!finalOk) {
      throw new Error(
        data?.message ||
          data?.msg ||
          sprocParsed?.msg ||
          sprocParsed?.message ||
          firstRow?.message ||
          "Submission failed."
      );
    }

    return {
      raw: data,
      message:
        data?.message ||
        data?.msg ||
        sprocParsed?.msg ||
        sprocParsed?.message ||
        firstRow?.message ||
        "Offset application submitted successfully.",
    };
  },

  onSuccess: (result) => {
    // show success immediately
    toast.success(result.message);

    setSelectedRecord(null);
    form.reset({
      offsetDate: dayjs().format("YYYY-MM-DD"),
      offsetType: form.getValues("offsetType"),
      offsetHours: "",
      remarks: "",
    });

    // refetch after toast
    queryClient.invalidateQueries({ queryKey: ["offsetHistory"] });
    queryClient.invalidateQueries({ queryKey: ["dtrRecords"] });
  },

  onError: (err) => {
    console.error("submit offset error:", err);
    toast.error(err?.message || "Failed to submit offset application.");
  },
});

  const cancelMutation = useMutation({
    mutationFn: (payload) => axios.post(API_ENDPOINTS.cancelOffset, payload),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Offset application cancelled.");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to cancel offset application.");
    },
  });

  /* =========================
      SUBMIT FLOW
  ========================= */

  const onSubmitForm = (values) => {
    if (!selectedRecord) {
      toast.warning("Please select an overtime record.");
      return;
    }

    const remaining = getRemainingBalance(selectedRecord);
    if (Number(values.offsetHours) > remaining) {
      toast.error(`Exceeded balance. Remaining: ${remaining} hour(s).`);
      return;
    }

    const payload = {
      json_data: {
        empNo: user.empNo,
        offsetDate: values.offsetDate,
        offsetHrs: Number(values.offsetHours),
        offsetRemarks: values.remarks,
        offsetType: values.offsetType,
        sourceDate: selectedRecord.date,
      },
    };

    setPendingSubmitPayload({
      payload,
      values,
      remainingAfter: Math.max(
        Number(remaining) - Number(values.offsetHours || 0),
        0,
      ).toFixed(2),
    });
    setConfirmSubmitOpen(true);
  };

  const confirmSubmit = () => {
    if (!pendingSubmitPayload?.payload) return;
    submitMutation.mutate(pendingSubmitPayload.payload);
    setConfirmSubmitOpen(false);
    setPendingSubmitPayload(null);
  };

  /* =========================
      CANCEL FLOW
  ========================= */

  const requestCancel = (entry) => {
    setPendingCancelEntry(entry);
    setConfirmCancelOpen(true);
  };

  const confirmCancel = () => {
    if (!pendingCancelEntry) return;
    cancelMutation.mutate({
      json_data: {
        empNo: user.empNo,
        offsetStamp: pendingCancelEntry.offsetStamp,
      },
    });
    setConfirmCancelOpen(false);
    setPendingCancelEntry(null);
  };

  /* =========================
      FILTER HISTORY (business rule)
  ========================= */

  const filteredApplications = useMemo(() => {
    let rows = [...offsetApplications];

    if (historyStatus) rows = rows.filter((r) => r.offsetStatus === historyStatus);
    if (historyOffsetType) rows = rows.filter((r) => r.offsetType === historyOffsetType);

    // date range already applied by API using historyDateFrom/historyDateTo
    return rows;
  }, [offsetApplications, historyStatus, historyOffsetType]);

  /* =========================
      TANSTACK TABLE (Sort + Pagination)
  ========================= */

  const [sorting, setSorting] = useState([]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "offsetDate",
        header: "Offset Date",
        cell: (info) => fmtDate(info.getValue()),
      },
      {
        accessorKey: "offsetHours",
        header: "Duration",
        cell: (info) => `${info.getValue()} hr(s)`,
      },
      {
        accessorKey: "remarks",
        header: "Employee Remarks",
        cell: (info) => info.getValue() || "N/A",
      },
      {
        accessorKey: "approverRemarks",
        header: "Approver Remarks",
        cell: (info) => info.getValue() || "—",
      },
      {
        accessorKey: "offsetStatus",
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <PendingCancelButton
            entry={row.original}
            onCancel={requestCancel}
            isBusy={cancelMutation.isPending}
          />
        ),
      },
    ],
    [cancelMutation.isPending],
  );

  const table = useReactTable({
    data: filteredApplications,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const pagedEntries = table.getRowModel().rows.map((r) => r.original);

  /* ===========================================================
      RENDER
  =========================================================== */

  return (
    <div className="ml-0 lg:ml-[200px] mt-[70px] lg:mt-[80px] p-2 sm:p-4 bg-gray-100 min-h-screen">
      {/* LOADING (initial only) */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white px-8 py-5 rounded-xl shadow-xl flex items-center gap-4">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-gray-700">Loading...</span>
          </div>
        </div>
      )}

      {(dtrError || historyError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-3 text-sm">
          {String(
            dtrErrorObj?.message ||
              historyErrorObj?.message ||
              "Failed to load data. Please refresh or try again.",
          )}
        </div>
      )}

      <div className="global-div-header-ui">
        <h1 className="global-div-headertext-ui">My Offset Applications</h1>
      </div>

      {/* ================= FILTER TIMEKEEPING ================= */}
      <div className="mt-4 bg-white p-4 shadow-md rounded-lg">
        <h2 className="text-base font-semibold">Filter Timekeeping Records</h2>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <DateInput
            id="tkDateFrom"
            value={tkDateFrom}
            onChange={(e) => setTkDateFrom(e.target.value)}
          />
          <DateInput
            id="tkDateTo"
            value={tkDateTo}
            onChange={(e) => setTkDateTo(e.target.value)}
            min={tkDateFrom}
          />

          <Select value={recordFrom} onValueChange={setRecordFrom}>
            <SelectTrigger>
              <SelectValue placeholder="Select record type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Records</SelectItem>
              <SelectItem value="Opening">Opening – Pre-Shift Overtime</SelectItem>
              <SelectItem value="Closing">Closing – Post-Shift Overtime</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ================= TIMEKEEPING RECORDS ================= */}
      <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Timekeeping Records</h2>
          {syncing && <span className="text-xs text-gray-500">Syncing…</span>}
        </div>

        <div className="w-full overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs sm:text-sm text-center border-collapse">
            <thead className="sticky top-0 z-10 bg-blue-800 text-white text-xs sm:text-sm">
              <tr>
                {[
                  "Date",
                  "Time In",
                  "Time Out",
                  "Available Hours",
                  "Remaining Hours",
                  "Total Hours",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="py-2 px-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="global-tbody">
              {validOffsetRecords.length ? (
                validOffsetRecords.map((row) => {
                  const remaining = Number(row?.remainingHours || 0);
                  const isDisabled = remaining <= 0;
                  const isSelected = selectedRecord?.id === row.id;

                  const displayHours =
                    recordFrom === "Opening"
                      ? row.openingHours
                      : recordFrom === "Closing"
                        ? row.closingHours
                        : row.totalOT;

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "global-tr transition-all",
                        isSelected && "bg-blue-50 font-semibold",
                      )}
                    >
                      <td className="global-td whitespace-nowrap">
                        {fmtDate(row.date)}
                      </td>
                      <td className="global-td whitespace-nowrap">{row.timeIn}</td>
                      <td className="global-td whitespace-nowrap">{row.timeOut}</td>

                      <td className="global-td text-blue-700 font-semibold whitespace-nowrap">
                        {Number(displayHours || 0).toFixed(2)} hr(s)
                      </td>

                      <td className="global-td text-green-700 font-semibold whitespace-nowrap">
                        {Number(row.remainingHours || 0).toFixed(2)} hr(s)
                      </td>

                      <td className="global-td font-bold whitespace-nowrap">
                        {Number(row.totalHours || 0).toFixed(2)} hr(s)
                      </td>

                      <td className="global-td whitespace-nowrap">
                        <Button
                          size="sm"
                          disabled={isDisabled}
                          className={cn(
                            "h-7 text-xs text-white",
                            BRAND_BLUE,
                            isDisabled && "opacity-60 cursor-not-allowed",
                          )}
                          onClick={() => !isDisabled && handleSelectRecord(row)}
                        >
                          {isDisabled
                            ? "Fully Consumed"
                            : isSelected
                              ? "Selected"
                              : "Select"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
                    No valid overtime records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= OVERTIME SOURCE DETAILS ================= */}
      <div className="mt-4 bg-white p-6 shadow rounded-lg text-sm">
        <h2 className="text-base font-semibold mb-4">Overtime Source Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block font-semibold mb-1 text-gray-600">Date</label>
            <Input readOnly value={selectedRecord ? fmtDate(selectedRecord.date) : "—"} />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-600">Time From</label>
            <Input readOnly value={selectedRecord ? selectedRecord.timeIn : "—"} />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-600">Time To</label>
            <Input readOnly value={selectedRecord ? selectedRecord.timeOut : "—"} />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-blue-700">
              Available Offset Hours
            </label>
            <Input
              readOnly
              className="bg-blue-50 text-blue-800 font-semibold"
              value={
                selectedRecord
                  ? `${Number(selectedRecord.totalOT || 0).toFixed(2)} hr(s)`
                  : "0.00 hr(s)"
              }
            />
          </div>
        </div>
      </div>

      {/* ================= OFFSET APPLICATION DETAILS ================= */}
      <div className="mt-4 bg-white p-6 shadow-md rounded-lg">
        <h2 className="text-base font-semibold mb-5">Offset Application Details</h2>

        <form onSubmit={form.handleSubmit(onSubmitForm)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Offset Date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">
                Offset Date <span className="text-red-500">*</span>
              </label>
              <DateInput
                id="offsetDate"
                value={form.watch("offsetDate")}
                onChange={(e) => form.setValue("offsetDate", e.target.value)}
              />
              {form.formState.errors.offsetDate && (
                <span className="text-xs text-red-600 mt-1">
                  {form.formState.errors.offsetDate.message}
                </span>
              )}
            </div>

            {/* Offset Type */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">
                Offset Type <span className="text-red-500">*</span>
              </label>
              <Controller
                control={form.control}
                name="offsetType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select offset type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Opening">
                        Opening – Pre-Shift Overtime
                      </SelectItem>
                      <SelectItem value="Closing">
                        Closing – Post-Shift Overtime
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.offsetType && (
                <span className="text-xs text-red-600 mt-1">
                  {form.formState.errors.offsetType.message}
                </span>
              )}
            </div>

            {/* Total Hours */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">
                Total Hours <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.5"
                placeholder="Enter hours"
                {...form.register("offsetHours")}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  const remaining = selectedRecord ? getRemainingBalance(selectedRecord) : 0;
                  if (value > remaining) form.setValue("offsetHours", remaining);
                  else form.setValue("offsetHours", e.target.value);
                }}
              />
              {form.formState.errors.offsetHours && (
                <span className="text-xs text-red-600 mt-1">
                  {form.formState.errors.offsetHours.message}
                </span>
              )}
            </div>

            {/* Remaining Balance */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-blue-700 mb-1">
                Remaining Balance
              </label>
              <Input
                readOnly
                className="bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                value={selectedRecord ? `${computedRemainingBalance} hr(s)` : "0.00 hr(s)"}
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Remarks / Reason <span className="text-red-500">*</span>
            </label>
            <Textarea rows={4} {...form.register("remarks")} />
            {form.formState.errors.remarks && (
              <span className="text-xs text-red-600 mt-1 block">
                {form.formState.errors.remarks.message}
              </span>
            )}
          </div>

          {/* Submit */}
          <div className="text-center">
            <Button
              type="submit"
              disabled={!selectedRecord || submitMutation.isPending}
              className={cn(
                "px-10 h-11 text-white",
                BRAND_BLUE,
                (!selectedRecord || submitMutation.isPending) && "opacity-70",
              )}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </div>

      {/* ================= FILTER HISTORY ================= */}
      <div className="mt-4 bg-white p-4 shadow-md rounded-lg">
        <h2 className="text-base font-semibold">Filter Timekeeping Records History</h2>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <DateInput
            id="historyDateFrom"
            value={historyDateFrom}
            onChange={(e) => setHistoryDateFrom(e.target.value)}
          />
          <DateInput
            id="historyDateTo"
            value={historyDateTo}
            onChange={(e) => setHistoryDateTo(e.target.value)}
            min={historyDateFrom || undefined}
          />

          <Select
            value={historyOffsetType || "ALL"}
            onValueChange={(v) => setHistoryOffsetType(v === "ALL" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Records</SelectItem>
              <SelectItem value="Opening">Opening – Pre-Shift Overtime</SelectItem>
              <SelectItem value="Closing">Closing – Post-Shift Overtime</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={historyStatus || "ALL"}
            onValueChange={(v) => setHistoryStatus(v === "ALL" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="Disapproved">Disapproved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ================= HISTORY ================= */}
      <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-semibold">Offset Application History</h2>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>

        {/* CARD VIEW */}
        {viewMode === "card" && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pagedEntries.length ? (
              pagedEntries.map((entry, idx) => (
                <div key={idx} className="border rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm md:text-base">
                      {fmtDate(entry.offsetDate)}
                    </div>
                    <StatusBadge status={entry.offsetStatus} />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">Offset Type</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs rounded-full",
                        entry.offsetType === "Opening"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700",
                      )}
                    >
                      {entry.offsetType}
                    </span>
                  </div>

                  <div className="space-y-1 text-[12px] md:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-semibold">Hours</span>
                      <span className="font-medium">{entry.offsetHours} hr(s)</span>
                    </div>

                    <div className="mt-2">
                      <div className="text-gray-500 font-semibold">Employee Remarks:</div>
                      <div className="font-normal break-words text-black">
                        {entry.remarks || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="text-gray-500 font-semibold">Approver Remarks:</div>
                    <div className="font-normal break-words text-black">
                      {entry.approverRemarks || "—"}
                    </div>
                  </div>

                  {entry?.offsetStatus === "Pending" && (
                    <div className="mt-3 text-right">
                      <PendingCancelButton
                        entry={entry}
                        onCancel={requestCancel}
                        isBusy={cancelMutation.isPending}
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-gray-500 py-6">
                No offset applications found.
              </div>
            )}
          </div>
        )}

        {/* ACCORDION VIEW */}
        {viewMode === "accordion" && (
          <div className="mt-4 divide-y border rounded-lg">
            {pagedEntries.length ? (
              pagedEntries.map((entry, idx) => (
                <details key={idx} className="group p-2 text-[12px] md:text-sm">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="font-medium">
                      {fmtDate(entry.offsetDate)} • {entry.offsetHours} hr(s)
                    </div>
                    <StatusBadge status={entry.offsetStatus} />
                  </summary>

                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="text-gray-500 font-semibold">Employee Remarks</div>
                      <div>{entry.remarks || "N/A"}</div>
                    </div>

                    <div>
                      <div className="text-gray-500 font-semibold">Approver Remarks</div>
                      <div>{entry.approverRemarks || "—"}</div>
                    </div>

                    {entry?.offsetStatus === "Pending" && (
                      <div className="pt-2 text-right">
                        <PendingCancelButton
                          entry={entry}
                          onCancel={requestCancel}
                          isBusy={cancelMutation.isPending}
                        />
                      </div>
                    )}
                  </div>
                </details>
              ))
            ) : (
              <div className="text-center text-gray-500 py-6">
                No offset applications found.
              </div>
            )}
          </div>
        )}

        {/* TABLE VIEW */}
        {viewMode === "table" && (
          <div className="w-full overflow-x-auto mt-4 rounded-lg border border-gray-200">
            <table className="w-full text-xs sm:text-sm text-center border-collapse">
              <thead className="sticky top-0 z-10 bg-blue-800 text-white text-xs sm:text-sm">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          className={cn(
                            "py-2 px-3 whitespace-nowrap",
                            canSort && "cursor-pointer select-none",
                          )}
                          onClick={
                            canSort ? header.column.getToggleSortingHandler() : undefined
                          }
                          title={canSort ? "Click to sort" : undefined}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {canSort && (
                            <span className="ml-1">
                              {sortDir === "asc" ? "↑" : sortDir === "desc" ? "↓" : ""}
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>

              <tbody className="global-tbody">
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="global-tr">
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            "global-td",
                            cell.column.id === "remarks" && "text-left max-w-[240px] truncate",
                            cell.column.id === "approverRemarks" &&
                              "text-left max-w-[240px] truncate",
                          )}
                          title={
                            cell.column.id === "remarks"
                              ? row.original.remarks || "N/A"
                              : cell.column.id === "approverRemarks"
                                ? row.original.approverRemarks || "—"
                                : undefined
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-500">
                      No offset applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination (TanStack Table) */}
        {filteredApplications.length > 0 && (
          <div className="flex justify-between items-center mt-4 pt-3 border-t">
            <div className="text-xs text-gray-600">
              Showing{" "}
              <b>
                {filteredApplications.length === 0
                  ? "0-0"
                  : `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-${Math.min(
                      (table.getState().pagination.pageIndex + 1) *
                        table.getState().pagination.pageSize,
                      filteredApplications.length,
                    )}`}
              </b>{" "}
              of {filteredApplications.length} entries
            </div>

            <div className="flex items-center text-sm border rounded-lg overflow-hidden">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-3 py-1 border-r hover:bg-gray-100 disabled:text-gray-400"
                type="button"
              >
                &lt;
              </button>

              {Array.from({ length: table.getPageCount() }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => table.setPageIndex(i)}
                  className={cn(
                    "px-3 py-1 border-r",
                    table.getState().pagination.pageIndex === i
                      ? "bg-blue-800 text-white"
                      : "hover:bg-gray-100",
                  )}
                  type="button"
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-3 py-1 hover:bg-gray-100 disabled:text-gray-400"
                type="button"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= CONFIRM SUBMIT DIALOG ================= */}
      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Offset Application</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-gray-700 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="font-semibold">Source Date:</div>
                  <div>{selectedRecord ? fmtDate(selectedRecord.date) : "—"}</div>

                  <div className="font-semibold">Time From:</div>
                  <div>{selectedRecord?.timeIn || "—"}</div>

                  <div className="font-semibold">Time To:</div>
                  <div>{selectedRecord?.timeOut || "—"}</div>

                  <div className="font-semibold">Offset Date:</div>
                  <div>{fmtDate(pendingSubmitPayload?.values?.offsetDate)}</div>

                  <div className="font-semibold">Hours:</div>
                  <div>{pendingSubmitPayload?.values?.offsetHours ?? "—"}</div>

                  <div className="font-semibold">Remaining After:</div>
                  <div>{pendingSubmitPayload?.remainingAfter ?? "—"} hr(s)</div>

                  <div className="font-semibold">Remarks:</div>
                  <div className="break-words col-span-1">
                    {pendingSubmitPayload?.values?.remarks || "—"}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction
              onClick={confirmSubmit}
              className={cn("text-white", BRAND_BLUE)}
            >
              Yes, Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================= CONFIRM CANCEL DIALOG ================= */}
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this application?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-gray-700 space-y-2">
                <div>
                  This will mark your pending offset request as{" "}
                  <span className="font-semibold">Cancelled</span>.
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="font-semibold">Offset Date:</div>
                  <div>{fmtDate(pendingCancelEntry?.offsetDate)}</div>

                  <div className="font-semibold">Hours:</div>
                  <div>{pendingCancelEntry?.offsetHours ?? "—"} hr(s)</div>

                  <div className="font-semibold">Status:</div>
                  <div>{pendingCancelEntry?.offsetStatus ?? "—"}</div>

                  <div className="font-semibold">Remarks:</div>
                  <div className="break-words">{pendingCancelEntry?.remarks || "—"}</div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmCancel}
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OffsetApplication;