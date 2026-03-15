import { User as UserIcon } from "lucide-react";

export default function AuthButton() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors">
      <UserIcon className="w-4 h-4" />
      Guest Mode
    </div>
  );
}
