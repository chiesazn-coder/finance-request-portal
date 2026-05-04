"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  title: string;
  purpose: string;
  amount: number;
  status: RequestStatus;
  created_at: string;
  profiles: RequesterProfile | RequesterProfile[] | null;
};

type DashboardStats = {
  total: number;
  submitted: number;
  reviewed_by_admin: number;
  approved_by_ceo: number;
  released: number;
  rejected: number;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function getStatusLabel(status: RequestStatus) {
  const labels: Record<RequestStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    reviewed_by_admin: "Reviewed by Admin",
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

function getRequesterName(profiles: FinanceRequest["profiles"]) {
  if (!profiles) return "-";

  if (Array.isArray(profiles)) {
    return profiles[0]?.full_name || "-";
  }

  return profiles.full_name || "-";
}

function getRoleLabel(role: Role) {
  const labels: Record<Role, string> = {
    ga: "General Affair",
    admin_finance: "Admin Finance",
    ceo: "CEO",
    finance_manager: "Finance Manager",
  };

  return labels[role];
}

function getRoleDescription(role: Role) {
  const descriptions: Record<Role, string> = {
    ga: "Kamu dapat membuat request petty cash dan memantau status pengajuan.",
    admin_finance:
      "Kamu dapat mereview request dari GA dan meneruskannya ke CEO.",
    ceo: "Kamu dapat memberikan approval atau rejection untuk request yang sudah direview Finance.",
    finance_manager:
      "Kamu dapat melakukan release dana setelah request disetujui CEO.",
  };

  return descriptions[role];
}

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentRequests, setRecentRequests] = useState<FinanceRequest[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    submitted: 0,
    reviewed_by_admin: 0,
    approved_by_ceo: 0,
    released: 0,
    rejected: 0,
  });

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      async function loadDashboard() {
        setLoading(true);
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

        const currentProfile = profileData as Profile;
        setProfile(currentProfile);

        let query = supabase
          .from("finance_requests")
          .select(
            `
            id,
            request_no,
            title,
            purpose,
            amount,
            status,
            created_at,
            profiles:requester_id (
              full_name,
              email,
              department
            )
          `
          )
          .order("created_at", { ascending: false });

        if (currentProfile.role === "ga") {
          query = query.eq("requester_id", currentProfile.id);
        }

        const { data: requestData, error: requestError } = await query;

        if (requestError) {
          setErrorMessage(requestError.message);
          setLoading(false);
          return;
        }

        const requests = (requestData || []) as unknown as FinanceRequest[];

        setRecentRequests(requests.slice(0, 5));

        setStats({
          total: requests.length,
          submitted: requests.filter((item) => item.status === "submitted")
            .length,
          reviewed_by_admin: requests.filter(
            (item) => item.status === "reviewed_by_admin"
          ).length,
          approved_by_ceo: requests.filter(
            (item) => item.status === "approved_by_ceo"
          ).length,
          released: requests.filter((item) => item.status === "released")
            .length,
          rejected: requests.filter((item) => item.status === "rejected")
            .length,
        });

        setLoading(false);
      }

      void loadDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-600">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Balancia Internal Portal
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Finance Request Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Monitor petty cash request, approval progress, and fund release in
              one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/requests"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View Requests
            </Link>

            {profile?.role === "ga" && (
              <Link
                href="/requests/new"
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                New Request
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm text-slate-500">Welcome back,</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {profile?.full_name}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {profile?.email}
                </p>
              </div>

              {profile && (
                <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  {getRoleLabel(profile.role)}
                </span>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">
                Your role in this workflow
              </p>
              <p className="mt-2 text-sm text-slate-600 leading-6">
                {profile ? getRoleDescription(profile.role) : "-"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-blue-600 p-6 shadow-sm text-white">
            <p className="text-sm font-medium text-blue-100">
              Current Workflow
            </p>
            <h2 className="mt-2 text-xl font-bold">
              Petty Cash Approval Flow
            </h2>

            <div className="mt-6 space-y-3 text-sm">
              <div className="rounded-xl bg-white/10 px-4 py-3">
                GA Submit Request
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3">
                Admin Finance Review
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3">
                CEO Approval
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3">
                Finance Manager Release
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {stats.total}
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Submitted
            </p>
            <p className="mt-3 text-3xl font-bold text-blue-600">
              {stats.submitted}
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reviewed
            </p>
            <p className="mt-3 text-3xl font-bold text-purple-600">
              {stats.reviewed_by_admin}
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Approved
            </p>
            <p className="mt-3 text-3xl font-bold text-emerald-600">
              {stats.approved_by_ceo}
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Released
            </p>
            <p className="mt-3 text-3xl font-bold text-green-600">
              {stats.released}
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rejected
            </p>
            <p className="mt-3 text-3xl font-bold text-red-600">
              {stats.rejected}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-6 py-5 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Recent Requests
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Request terbaru yang masuk ke sistem.
              </p>
            </div>

            <Link
              href="/requests"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View all requests
            </Link>
          </div>

          {recentRequests.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-semibold text-slate-900">
                Belum ada request
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Request petty cash yang dibuat akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4 text-left font-semibold text-slate-700">
                      Request No
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-700">
                      Title
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-700">
                      Requester
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-700">
                      Amount
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-700">
                      Status
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-700">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {recentRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-slate-700 whitespace-nowrap">
                        {request.request_no || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {request.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {request.purpose}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-700 whitespace-nowrap">
                        {getRequesterName(request.profiles)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(request.amount)}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                            request.status
                          )}`}
                        >
                          {getStatusLabel(request.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <Link
                          href={`/requests/${request.id}`}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                          View Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}