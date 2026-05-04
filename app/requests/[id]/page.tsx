"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Role = "ga" | "admin_finance" | "ceo" | "finance_manager";

type RequestStatus =
  | "draft"
  | "submitted"
  | "reviewed_by_admin"
  | "approved_by_ceo"
  | "rejected"
  | "released";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department: string | null;
};

type RequesterProfile = {
  full_name: string;
  email: string;
  department: string | null;
};

type FinanceRequest = {
  id: string;
  request_no: string | null;
  requester_id: string;
  title: string;
  description: string | null;
  purpose: string;
  amount: number;
  needed_date: string | null;
  status: RequestStatus;
  admin_finance_id: string | null;
  ceo_id: string | null;
  finance_manager_id: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  release_method: string | null;
  release_date: string | null;
  release_note: string | null;
  release_attachment_url: string | null;
  release_attachment_name: string | null;
  created_at: string;
  updated_at: string;
  profiles: RequesterProfile | RequesterProfile[] | null;
};

type ApprovalHistory = {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
  profiles: RequesterProfile | RequesterProfile[] | null;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | null) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string | null) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getProfileName(profiles: RequesterProfile | RequesterProfile[] | null) {
  if (!profiles) return "-";

  if (Array.isArray(profiles)) {
    return profiles[0]?.full_name || "-";
  }

  return profiles.full_name || "-";
}

function getStatusLabel(status: RequestStatus) {
  const labels: Record<RequestStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    reviewed_by_admin: "Reviewed by Admin Finance",
    approved_by_ceo: "Approved by CEO",
    rejected: "Rejected",
    released: "Released",
  };

  return labels[status];
}

function getStatusClass(status: RequestStatus) {
  if (status === "submitted") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (status === "reviewed_by_admin") {
    return "bg-purple-50 text-purple-700 border-purple-200";
  }

  if (status === "approved_by_ceo") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "released") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getActionInfo(role: Role, status: RequestStatus) {
  if (role === "admin_finance" && status === "submitted") {
    return "Admin Finance dapat mereview request ini dan meneruskannya ke CEO.";
  }

  if (role === "ceo" && status === "reviewed_by_admin") {
    return "CEO dapat approve atau reject request ini.";
  }

  if (role === "finance_manager" && status === "approved_by_ceo") {
    return "Finance Manager dapat melakukan release dana dan upload bukti release.";
  }

  if (status === "released") {
    return "Request ini sudah selesai dan dana sudah direlease.";
  }

  if (status === "rejected") {
    return "Request ini sudah direject dan tidak dapat diproses lebih lanjut.";
  }

  return "Belum ada action yang tersedia untuk role kamu pada status ini.";
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();

  const requestId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [request, setRequest] = useState<FinanceRequest | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);

  const [note, setNote] = useState("");
  const [releaseMethod, setReleaseMethod] = useState("Cash");
  const [releaseDate, setReleaseDate] = useState(getTodayDate());
  const [releaseAttachmentFile, setReleaseAttachmentFile] =
    useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDetail = useCallback(
    async (showLoading = true) => {
      await Promise.resolve();

      if (showLoading) {
        setLoading(true);
      }

      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, department")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        setErrorMessage("Profile user tidak ditemukan.");
        setLoading(false);
        return;
      }

      setProfile(profileData as Profile);

      const { data: requestData, error: requestError } = await supabase
        .from("finance_requests")
        .select(
          `
          id,
          request_no,
          requester_id,
          title,
          description,
          purpose,
          amount,
          needed_date,
          status,
          admin_finance_id,
          ceo_id,
          finance_manager_id,
          attachment_url,
          attachment_name,
          release_method,
          release_date,
          release_note,
          release_attachment_url,
          release_attachment_name,
          created_at,
          updated_at,
          profiles:requester_id (
            full_name,
            email,
            department
          )
        `
        )
        .eq("id", requestId)
        .single();

      if (requestError || !requestData) {
        setErrorMessage(requestError?.message || "Request tidak ditemukan.");
        setLoading(false);
        return;
      }

      setRequest(requestData as unknown as FinanceRequest);

      const { data: historyData, error: historyError } = await supabase
        .from("request_approvals")
        .select(
          `
          id,
          action,
          note,
          created_at,
          profiles:actor_id (
            full_name,
            email,
            department
          )
        `
        )
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (historyError) {
        setErrorMessage(historyError.message);
        setLoading(false);
        return;
      }

      setApprovalHistory((historyData || []) as unknown as ApprovalHistory[]);
      setLoading(false);
    },
    [requestId, router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetail(true);
  }, [loadDetail]);

  async function uploadReleaseAttachment(requestNo: string) {
    if (!releaseAttachmentFile) {
      return {
        releaseAttachmentUrl: null,
        releaseAttachmentName: null,
      };
    }

    const fileExt = releaseAttachmentFile.name.split(".").pop();
    const safeRequestNo = requestNo || requestId;
    const filePath = `${safeRequestNo}/release-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("finance-attachments")
      .upload(filePath, releaseAttachmentFile);

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("finance-attachments")
      .getPublicUrl(filePath);

    return {
      releaseAttachmentUrl: data.publicUrl,
      releaseAttachmentName: releaseAttachmentFile.name,
    };
  }

  async function handleAction(
    actionType: "review" | "approve" | "reject" | "release"
  ) {
    if (!profile || !request) return;

    setProcessing(true);
    setErrorMessage("");

    try {
      let nextStatus: RequestStatus | null = null;
      let actionLabel = "";

      if (actionType === "review") {
        nextStatus = "reviewed_by_admin";
        actionLabel = "Reviewed by Admin Finance";
      }

      if (actionType === "approve") {
        nextStatus = "approved_by_ceo";
        actionLabel = "Approved by CEO";
      }

      if (actionType === "reject") {
        nextStatus = "rejected";
        actionLabel = "Rejected";
      }

      if (actionType === "release") {
        nextStatus = "released";
        actionLabel = "Released by Finance Manager";
      }

      if (!nextStatus) {
        setProcessing(false);
        return;
      }

      const updatePayload: {
        status: RequestStatus;
        admin_finance_id?: string;
        ceo_id?: string;
        finance_manager_id?: string;
        release_method?: string;
        release_date?: string;
        release_note?: string | null;
        release_attachment_url?: string | null;
        release_attachment_name?: string | null;
      } = {
        status: nextStatus,
      };

      if (actionType === "review") {
        updatePayload.admin_finance_id = profile.id;
      }

      if (actionType === "approve" || actionType === "reject") {
        updatePayload.ceo_id = profile.id;
      }

      if (actionType === "release") {
        if (!releaseMethod) {
          throw new Error("Release method wajib dipilih.");
        }

        if (!releaseDate) {
          throw new Error("Release date wajib diisi.");
        }

        const { releaseAttachmentUrl, releaseAttachmentName } =
          await uploadReleaseAttachment(request.request_no || request.id);

        updatePayload.finance_manager_id = profile.id;
        updatePayload.release_method = releaseMethod;
        updatePayload.release_date = releaseDate;
        updatePayload.release_note = note || null;
        updatePayload.release_attachment_url = releaseAttachmentUrl;
        updatePayload.release_attachment_name = releaseAttachmentName;
      }

      const { error: updateError } = await supabase
        .from("finance_requests")
        .update(updatePayload)
        .eq("id", request.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const historyNote =
        actionType === "release"
          ? `Release Method: ${releaseMethod}. ${
              note ? `Note: ${note}` : "No additional note."
            }`
          : note || null;

      const { error: historyError } = await supabase
        .from("request_approvals")
        .insert({
          request_id: request.id,
          actor_id: profile.id,
          action: actionLabel,
          note: historyNote,
        });

      if (historyError) {
        throw new Error(historyError.message);
      }

      setNote("");
      setReleaseAttachmentFile(null);
      await loadDetail(false);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Terjadi kesalahan saat memproses request.");
      }
    } finally {
      setProcessing(false);
    }
  }

  const canAdminReview =
    profile?.role === "admin_finance" && request?.status === "submitted";

  const canCeoApprove =
    profile?.role === "ceo" && request?.status === "reviewed_by_admin";

  const canFinanceRelease =
    profile?.role === "finance_manager" && request?.status === "approved_by_ceo";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-600">Loading request detail...</p>
      </main>
    );
  }

  if (!request) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
        <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            Request tidak ditemukan
          </h1>

          <Link
            href="/requests"
            className="mt-4 inline-flex text-sm font-semibold text-blue-600"
          >
            Back to Requests
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Finance Request Portal
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Request Detail
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Detail pengajuan, attachment, release proof, dan approval progress.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/requests"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to List
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-sm text-slate-500">
                  {request.request_no || "-"}
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {request.title}
                </h2>
              </div>

              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                  request.status
                )}`}
              >
                {getStatusLabel(request.status)}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Requester
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {getProfileName(request.profiles)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrency(request.amount)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Needed Date
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDate(request.needed_date)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Created At
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(request.created_at)}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Purpose
              </p>
              <p className="mt-2 text-sm text-slate-700 leading-6">
                {request.purpose}
              </p>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </p>
              <p className="mt-2 text-sm text-slate-700 leading-6 whitespace-pre-line">
                {request.description || "-"}
              </p>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Attachment
              </p>

              {request.attachment_url ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {request.attachment_name || "Attachment file"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Dokumen pendukung untuk request ini.
                  </p>

                  <a
                    href={request.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    View Attachment
                  </a>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Tidak ada attachment.
                </p>
              )}
            </div>

            {request.status === "released" && (
              <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                  Release Information
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                      Release Method
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {request.release_method || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                      Release Date
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatDate(request.release_date)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    Release Note
                  </p>
                  <p className="mt-1 text-sm text-slate-700 leading-6">
                    {request.release_note || "-"}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    Release Proof
                  </p>

                  {request.release_attachment_url ? (
                    <div className="mt-2 rounded-xl border border-green-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {request.release_attachment_name ||
                          "Release proof attachment"}
                      </p>

                      <a
                        href={request.release_attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        View Release Proof
                      </a>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      Tidak ada bukti release yang diupload.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm h-fit">
            <h2 className="text-lg font-bold text-slate-900">
              Approval Action
            </h2>

            <p className="mt-2 text-sm text-slate-600 leading-6">
              {profile
                ? getActionInfo(profile.role, request.status)
                : "Action akan muncul sesuai role dan status request saat ini."}
            </p>

            {canFinanceRelease && (
              <div className="mt-5 space-y-5 rounded-xl border border-green-200 bg-green-50 p-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Release Method
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-400 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    value={releaseMethod}
                    onChange={(event) => setReleaseMethod(event.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Release Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-400 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    value={releaseDate}
                    onChange={(event) => setReleaseDate(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Release Proof
                  </label>
                  <input
                    type="file"
                    className="w-full rounded-xl border border-slate-400 bg-white px-4 py-3 text-sm text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-green-700"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setReleaseAttachmentFile(file);
                    }}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Upload bukti transfer, tanda terima, atau bukti release
                    lainnya.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Note
              </label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder="Tambahkan catatan jika perlu..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="mt-5 space-y-3">
              {canAdminReview && (
                <>
                  <button
                    onClick={() => handleAction("review")}
                    disabled={processing}
                    className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                  >
                    {processing ? "Processing..." : "Review & Forward to CEO"}
                  </button>

                  <button
                    onClick={() => handleAction("reject")}
                    disabled={processing}
                    className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    Reject Request
                  </button>
                </>
              )}

              {canCeoApprove && (
                <>
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={processing}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {processing ? "Processing..." : "Approve Request"}
                  </button>

                  <button
                    onClick={() => handleAction("reject")}
                    disabled={processing}
                    className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    Reject Request
                  </button>
                </>
              )}

              {canFinanceRelease && (
                <button
                  onClick={() => handleAction("release")}
                  disabled={processing}
                  className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {processing ? "Processing..." : "Release Fund"}
                </button>
              )}

              {!canAdminReview && !canCeoApprove && !canFinanceRelease && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  Belum ada action yang tersedia untuk role kamu pada status ini.
                </div>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-6 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Approval History
          </h2>

          {approvalHistory.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Belum ada approval history.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {approvalHistory.map((history) => (
                <div
                  key={history.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {history.action}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        By {getProfileName(history.profiles)}
                      </p>
                    </div>

                    <p className="text-xs text-slate-500">
                      {formatDateTime(history.created_at)}
                    </p>
                  </div>

                  {history.note && (
                    <p className="mt-3 text-sm text-slate-700 leading-6">
                      {history.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}