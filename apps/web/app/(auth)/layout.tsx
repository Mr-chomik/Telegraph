export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-105">
        <header className="mb-8">
          <p className="masthead text-3xl">The Daily News</p>
          <hr className="hairline-heavy mt-4" />
        </header>
        {children}
      </div>
    </div>
  );
}