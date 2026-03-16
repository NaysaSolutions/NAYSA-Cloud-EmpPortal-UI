import { useNavigate, useLocation } from '@tanstack/react-router';
import { useAuth } from "./AuthContext";
import { useState } from "react"; // Back to local state
import { toast } from "sonner";
import { Menu, X } from "lucide-react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  
  // Local state for mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    // Perform logout logic
    toast.success("Logged out successfully");
    navigate({ to: "/" });
  };

  return (
    <>
      <div className="flex justify-center items-center bg-blue-900 text-white p-3 fixed top-0 left-0 w-full h-[30px] z-30">
        <span className="font-bold text-lg">NAYSA-SOLUTIONS, INC</span>
      </div>

      <nav className="flex justify-between items-center bg-white shadow-md p-1 fixed top-[15px] mt-3 left-0 w-full z-20">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate({ to: "/dashboard" })}>
          <img src="/naysa_logo.png" className="w-[75px] h-[45px]" alt="Logo" />
          <span className="text-blue-800 font-bold">Employee Portal</span>
        </div>

        {/* Desktop Nav */}
        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList>
            {/* Nav logic here... */}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <img src={user?.empNo ? `/${user.empNo}.jpg` : "/Default.jpg"} className="w-10 h-10 rounded-full" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed top-[80px] left-0 w-full bg-white p-4 shadow-md z-10">
          {/* Mobile links here */}
        </div>
      )}
    </>
  );
};