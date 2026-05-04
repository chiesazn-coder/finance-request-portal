"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "ga" | "admin_finance" | "ceo" | "finance_manager";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department: string | null;
};

function generateRequestNo() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  return `FR-${year}${month}${day}-${hour}${minute}${second}`;
}

export default function NewRequestPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [neededDate, setNeededDate] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      async function loadProfile() {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, department")
          .eq("id", user.id)
          .single();

        if (error || !data) {
          setErrorMessage("Profile user tidak ditemukan.");
          setLoading(false);
          return;
        }

        const currentProfile = data as Profile;

        if (currentProfile.role !== "ga") {
          router.push("/dashboard");
          return;
        }

        setProfile(currentProfile);
        setLoading(false);
      }

      void loadProfile();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router]);

  async function uploadAttachment(requestNo: string) {
    if (!attachmentFile) {
      return {
        attachmentUrl: null,
        attachmentName: null,
      };
    }

    const fileExt = attachmentFile.name.split(".").pop();
    const filePath = `${requestNo}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("finance-attachments")
      .upload(filePath, attachmentFile);

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("finance-attachments")
      .getPublicUrl(filePath);

    return {
      attachmentUrl: data.publicUrl,
      attachmentName: attachmentFile.name,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const numericAmount = Number(amount);

      if (!numericAmount || numericAmount <= 0) {
        throw new Error("Amount harus lebih dari 0.");
      }

      const requestNo = generateRequestNo();
      const { attachmentUrl, attachmentName } = await uploadAttachment(requestNo);

      const { error } = await supabase.from("finance_requests").insert({
        request_no: requestNo,
        requester_id: profile.id,
        title,
        purpose,
        description,
        amount: numericAmount,
        needed_date: neededDate || null,
        status: "submitted",
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      });

      if (error) {
        throw new Error(error.message);
      }

      router.push("/requests");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Terjadi kesalahan saat submit request.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-600">Loading form...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Finance Request Portal
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Buat Request Petty Cash
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Request akan dikirim ke Admin Finance untuk direview.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Judul Request
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="Contoh: Petty cash pembelian ATK"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tujuan Penggunaan
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="Contoh: Kebutuhan operasional kantor"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nominal
            </label>
            <input
              type="number"
              className="w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="Contoh: 500000"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              Masukkan angka tanpa titik atau koma.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tanggal Dibutuhkan
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
              value={neededDate}
              onChange={(event) => setNeededDate(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Attachment
            </label>
            <input
              type="file"
              className="w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setAttachmentFile(file);
              }}
            />
            <p className="mt-2 text-xs text-slate-500">
              Upload nota, invoice, quotation, atau dokumen pendukung lainnya.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Keterangan Tambahan
            </label>
            <textarea
              className="min-h-32 w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="Tambahkan detail kebutuhan jika ada..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}