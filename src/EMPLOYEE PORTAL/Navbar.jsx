import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner"; // Modern notifications
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // TanStack Query for User Data (handles caching and loading states)
  const { data: user } = useQuery({ 
    queryKey: ['authUser'],
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    // Perform logout API call then:
    toast.success("Successfully logged out");
    navigate("/");
  };

  return (
    <>
      <div className="bg-blue-900 text-white h-[30px] flex items-center justify-center font-bold">
        NAYSA-SOLUTIONS, INC
      </div>

      <nav className="bg-white shadow-md p-1 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <img src="/naysa_logo.png" className="w-[75px] h-[45px]" alt="Logo" />
          <span className="text-blue-800 font-bold">Employee Portal</span>
        </div>

        {/* Desktop Profile (Shadcn) */}
        <div className="hidden lg:flex items-center space-x-6">
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <img 
                src={user?.empNo ? `/${user.empNo}.jpg` : "/Default.jpg"} 
                className="w-10 h-10 rounded-full border border-gray-200 cursor-pointer" 
                alt="Profile"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Toggle */}
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2">
          <FontAwesomeIcon icon={isMobileMenuOpen ? faXmark : faBars} />
        </button>
      </nav>

      {/* Mobile Menu Flow */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-gray-50 border-t p-4 flex flex-col space-y-3">
          {/* Your Nav Links here */}
          <button className="text-red-600 text-left font-bold" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </>
  );
};