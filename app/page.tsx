import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: fighters, error } = await supabase
    .from('fighters')
    .select('name, weight_class, status')
    .order('weight_class')
    .order('name')

  if (error) {
    return (
      <div className="p-8 font-sans">
        <p className="text-red-600">Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-8 font-sans max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Seed validation — fighters ({fighters.length})</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">Weight class</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {fighters.map((f) => (
            <tr key={f.name} className="border-b last:border-0">
              <td className="py-1 pr-4">{f.name}</td>
              <td className="py-1 pr-4">{f.weight_class}</td>
              <td className="py-1">{f.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
