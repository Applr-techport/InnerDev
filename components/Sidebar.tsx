"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { name: "홈", path: "/" },
  { name: "앱 아이콘 생성기", path: "/app-icon" },
  { name: "이미지 변환기", path: "/image-converter" },
  { name: "이미지 사이즈 변경", path: "/image-resize" },
  { name: "앱스토어 스크린샷", path: "/screenshot" },
  { name: "견적서 생성기", path: "/quotation" },
  { name: "견적서 생성기(업무 단위 산정용)", path: "/quotation-task" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-6">
      <h2 className="text-xl font-bold mb-6">InnerDev</h2>
      <nav>
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`block px-4 py-2 rounded-lg transition-colors ${
                  pathname === item.path
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

