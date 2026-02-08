export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-6xl font-bold text-white mb-4">Maintainarr</h1>
        <p className="text-xl text-gray-400 mb-8">
          Task automation and metadata-driven grouping for the *arr ecosystem
        </p>
        <div className="bg-gray-800 rounded-lg p-6 text-left">
          <h2 className="text-2xl font-semibold text-white mb-4">Development Environment Ready</h2>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Next.js + Express server running
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              TypeScript configured with path aliases
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Tailwind CSS styling
            </li>
            <li className="flex items-center">
              <span className="text-gray-500 mr-2">○</span>
              Testing frameworks (Vitest, Cypress, Ladle)
            </li>
            <li className="flex items-center">
              <span className="text-gray-500 mr-2">○</span>
              PWA support
            </li>
          </ul>
        </div>
        <div className="mt-8 text-gray-500 text-sm">Port 5056 | tsx + nodemon | biome</div>
      </div>
    </div>
  );
}
