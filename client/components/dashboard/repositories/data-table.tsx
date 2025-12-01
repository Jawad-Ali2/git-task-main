"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, MoreHorizontal, Trash2, Search, Plug, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type Repository = {
  id: string
  githubId: string
  name: string
  url: string
  private: boolean
  ai_summary: string | null
  debt_score: number | null
  isScanning?: boolean
  isPaused?: boolean
  trelloIntegration?: {
    id: string
    status: string
    boardName?: string
  } | null
}

interface DataTableDemoProps {
  data: Repository[]
  onDeleteRepository?: (repoId: string) => Promise<void>
}

export const getColumns = (
  onDeleteRepository?: (repoId: string) => Promise<void>,
): ColumnDef<Repository>[] => [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Repository Name
            <ArrowUpDown size={15} />
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.getValue("name")}</span>
          {row.original.trelloIntegration && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Plug className="h-3 w-3" />
              Trello
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "private",
      header: "Visibility",
      cell: ({ row }) => (
        <div>{row.getValue("private") ? "Private" : "Public"}</div>
      ),
    },
    {
      accessorKey: "debt_score",
      header: () => <div className="text-right">Debt Score</div>,
      cell: ({ row }) => {
        const score = row.getValue("debt_score") as number | null
        return <div className="text-right">{score ?? "N/A"}</div>
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const repository = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/repositories/${repository.id}/tasks`}>
                  View Tasks
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(repository.url, "_blank")}
              >
                View on GitHub
              </DropdownMenuItem>
              {onDeleteRepository && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/repositories/${repository.id}/settings`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Repository Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete ${repository.name}?`)) {
                        await onDeleteRepository(repository.id)
                      }
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Repository
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

export function RepoTable({
  data,
  onDeleteRepository,
}: DataTableDemoProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const columns = React.useMemo(
    () => getColumns(onDeleteRepository),
    [onDeleteRepository]
  )

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" />
          <Input
            placeholder="Search repositories..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="pl-9 max-w-sm rounded-full"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Card className="px-6">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground ml-1 flex-1 text-sm">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
