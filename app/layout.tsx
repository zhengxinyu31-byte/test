import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'知衡 · 条件选股',description:'输入选股想法，确认条件，查看股票入选和排除依据。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
