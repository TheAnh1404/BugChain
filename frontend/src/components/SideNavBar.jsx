import { useAuth } from '../context/AuthContext';

export default function SideNavBar({ currentView, setCurrentView }) {
  const { user, isAuthenticated } = useAuth();
  const avatarUrl = user?.avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCxacxuVDWAIqgPnzjadeu9u3Ozv9g6EnK_feKbCP1cahs8rf_t7z2Blb3raAXJJ0bHXET20miO_feVgbmHTmVIo61Kbp8MaJuuxJfopu2_AnSLIgPZ-FdbcdI38crBLa01LPW7k9EAkVF3UE3474PBQTwxZIyQ6eq_V8y8EPpflA2QCr8naRwCREVRefRmzyg5CWqef-2FB2B9kXxCPp5oEIsZzj0PcerIDDG5AJiAahnAiQ8OoK-kj0P4wwkUMxojaituAxNx0Q0n";

  return (
    <aside className="hidden lg:flex flex-col w-60 fixed left-0 border-r border-[#4a4455] bg-[#1d1a24] p-6 gap-2 sticky top-20 h-[calc(100vh-80px)] overflow-y-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-[#37333e] overflow-hidden border border-[#4a4455]">
            <img 
              className="w-full h-full object-cover" 
              src={avatarUrl} 
              alt="Hacker Avatar" 
            />
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-[#d2bbff] text-sm leading-tight truncate">
              {isAuthenticated ? user?.username : 'Guest Console'}
            </p>
            <p className="text-[10px] text-[#ccc3d8] tracking-wider uppercase font-semibold">
              {isAuthenticated ? user?.role : 'Public User'}
            </p>
          </div>
        </div>
      </div>
      
      <nav className="flex flex-col gap-1.5 flex-1">
        <button 
          onClick={() => setCurrentView(isAuthenticated ? 'dashboard' : 'login')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'dashboard'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
          Overview
        </button>
        
        <button 
          onClick={() => setCurrentView('marketplace')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'marketplace' || currentView === 'details'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">security</span>
          Bounties
        </button>
        
        <button 
          onClick={() => setCurrentView(isAuthenticated ? 'dashboard' : 'login')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee] transition-all font-medium text-sm text-left"
        >
          <span className="material-symbols-outlined text-[20px]">description</span>
          Reports
        </button>

        <button
          onClick={() => setCurrentView(isAuthenticated ? 'analytics' : 'login')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'analytics'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">monitoring</span>
          Analytics
        </button>

        <button
          onClick={() => setCurrentView(isAuthenticated ? 'organizations' : 'login')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'organizations'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
          Organizations
        </button>

        <button
          onClick={() => setCurrentView(isAuthenticated ? 'feedback' : 'login')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'feedback'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">forum</span>
          Feedback
        </button>

        <button
          onClick={() => setCurrentView(isAuthenticated ? 'level4-analytics' : 'login')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'level4-analytics'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">query_stats</span>
          MVP Analytics
        </button>

        <button
          onClick={() => setCurrentView(isAuthenticated ? 'level4-proofs' : 'login')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'level4-proofs'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">fact_check</span>
          User Proofs
        </button>
        
        <button 
          onClick={() => setCurrentView(isAuthenticated ? 'profile' : 'login')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'profile'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          Settings
        </button>
        
        <button 
          onClick={() => setCurrentView(isAuthenticated ? 'create-bounty' : 'login')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
            currentView === 'create-bounty'
              ? 'bg-[#45464e] text-[#b4b4bd] font-bold'
              : 'text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">add_business</span>
          Launch Bounty
        </button>
      </nav>
      
      <button 
        onClick={() => setCurrentView(isAuthenticated ? 'submit' : 'login')}
        className="mt-auto w-full py-3 bg-[#37333e] hover:bg-[#7c3aed] hover:text-[#ede0ff] text-[#e8dfee] rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 duration-250 active:scale-95"
      >
        <span className="material-symbols-outlined text-[18px]">add_circle</span>
        Submit Report
      </button>
    </aside>
  );
}
