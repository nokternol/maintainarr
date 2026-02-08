export default function Custom404() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-500 mb-4">404</h1>
        <h2 className="text-3xl font-semibold text-white mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-8">The page you are looking for does not exist.</p>
        <a
          href="/"
          className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
