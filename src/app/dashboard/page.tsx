"use client";

import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Card from "@/src/components/ui/Card";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/solid";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#2D3748]">
            Dashboard Overview
          </h1>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            Generate Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-3xl font-bold text-[#805AD5] mt-1">156</p>
              </div>
              <div className="flex items-center text-green-500">
                <ArrowUpIcon className="h-4 w-4" />
                <span className="text-sm ml-1">12%</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming Events</p>
                <p className="text-3xl font-bold text-[#805AD5] mt-1">3</p>
              </div>
              <div className="flex items-center text-green-500">
                <ArrowUpIcon className="h-4 w-4" />
                <span className="text-sm ml-1">8%</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Attendance</p>
                <p className="text-3xl font-bold text-[#805AD5] mt-1">42</p>
              </div>
              <div className="flex items-center text-red-500">
                <ArrowDownIcon className="h-4 w-4" />
                <span className="text-sm ml-1">5%</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Donations</p>
                <p className="text-3xl font-bold text-[#805AD5] mt-1">$3,250</p>
              </div>
              <div className="flex items-center text-green-500">
                <ArrowUpIcon className="h-4 w-4" />
                <span className="text-sm ml-1">15%</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    {i}
                  </div>
                  <div>
                    <p className="text-sm font-medium">New member registered</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold mb-4">Upcoming Events</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    {i}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Sunday Service</p>
                    <p className="text-xs text-gray-500">Sunday, 9:00 AM</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-3 text-sm text-center rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100">
                Add Person
              </button>
              <button className="p-3 text-sm text-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">
                Create Event
              </button>
              <button className="p-3 text-sm text-center rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                Record Donation
              </button>
              <button className="p-3 text-sm text-center rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100">
                Take Attendance
              </button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
