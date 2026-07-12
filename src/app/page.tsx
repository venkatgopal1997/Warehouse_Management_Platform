import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Warehouse Management
        </h1>
        <p className="text-gray-600 mb-8">
          Multi-tenant warehouse platform with real-time analytics
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
