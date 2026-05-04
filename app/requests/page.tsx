"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "ga" | "admin_finance" | "ceo" | "finance_manager";

type RequestStatus =
  | "draft"
  | "submitted"
  | "reviewed_by_admin"
  | "approved_by_ceo"
  | "rejected"
  | "released";

type FilterStatus =
  | "all"
  | "need_action"
  | "submitted"
  | "reviewed_by_admin"
  | "approved_by_ceo"
  | "released"
  | "rejected";

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
  needed_date: string | null;
  status: RequestStatus;
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

function getRequesterName(profiles: FinanceRequest["profiles"]) {
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

function getNeedActionStatus(role: Role): RequestStatus | null {
  if (role === "admin_finance") return "submitted";
  if (role === "ceo") return "reviewed_by_admin";
  if (role === "finance_manager") return "approved_by_ceo";

  return null;
}

function getFilterLabel(filter: FilterStatus) {
  const labels: Record<FilterStatus, string> = {
    all: "All",
    need_action: "Need My Action",
    submitted: "Submitted",
    reviewed_by_admin: "Reviewed",
    approved_by_ceo: "Approved",
    released: "Released",
    rejected: "Rejected",
  };

  return labels[filter];
}

export default function RequestsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<FinanceRequest[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [searchKeyword, setSearchKeyword] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      async function loadData() {
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
            needed_date,
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

        setRequests((requestData || []) as unknown as FinanceRequest[]);
        setLoading(false);
      }

      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router]);

  const filteredRequests = useMemo(() => {
    let result = requests;

    if (activeFilter === "need_action" && profile) {
      const needActionStatus = getNeedActionStatus(profile.role);

      if (needActionStatus) {
        result = result.filter((request) => request.status === needActionStatus);
      } else {
        result = [];
      }
    }

    if (activeFilter !== "all" && activeFilter !== "need_action") {
      result = result.filter((request) => request.status === activeFilter);
    }

    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();

      result = result.filter((request) => {
        const requestNo = request.request_no?.toLowerCase() || "";
        const title = request.title.toLowerCase();
        const purpose = request.purpose.toLowerCase();
        const requester = getRequesterName(request.profiles).toLowerCase();

        return (
          requestNo.includes(keyword) ||
          title.includes(keyword) ||
          purpose.includes(keyword) ||
          requester.includes(keyword)
        );
      });
    }

    return result;
  }, [requests, activeFilter, searchKeyword, profile]);

  const filterOptions: FilterStatus[] = [
    "all",
    "need_action",
    "submitted",
    "reviewed_by_admin",
    "approved_by_ceo",
    "released",
    "rejected",
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-600">Loading requests...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Finance Request Portal
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Finance Requests
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {profile?.role === "ga"
                ? "Daftar request yang kamu ajukan."
                : "Daftar request yang perlu diproses sesuai role kamu."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </Link>

            {profile?.role === "ga" && (
              <Link
                href="/requests/new"
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                New Request
              </Link>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Request Filter
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Gunakan filter untuk mencari request berdasarkan status.
              </p>
            </div>

            <div className="w-full lg:w-80">
              <input
                type="text"
                className="w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder="Search request..."
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {filterOptions.map((filter) => {
              const isActive = activeFilter === filter;

              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={
                    isActive
                      ? "rounded-full border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  }
                >
                  {getFilterLabel(filter)}
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-6 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-6 py-5 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Request List
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Showing {filteredRequests.length} of {requests.length} requests.
              </p>
            </div>

            {profile && (
              <span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Role: {profile.role}
              </span>
            )}
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                Tidak ada request
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Tidak ada data yang sesuai dengan filter saat ini.
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
                      Needed Date
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
                  {filteredRequests.map((request) => (
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

                      <td className="px-5 py-4 text-slate-700 whitespace-nowrap">
                        {request.needed_date || "-"}
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
        </div>
      </div>
    </main>
  );
}