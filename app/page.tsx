import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <p className="text-sm font-medium text-blue-600 mb-2">
          Balancia Internal Portal
        </p>

        <h1 className="text-2xl font-bold text-slate-900">
          Finance Request Portal
        </h1>

        <p className="mt-3 text-sm text-slate-600 leading-6">
          Portal internal untuk pengajuan petty cash, approval finance, approval
          CEO, dan proses release dana.
        </p>

        <div className="mt-8">
          <Link
            href="/auth/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Masuk ke Portal
          </Link>
        </div>
      </div>
    </main>
  );
}