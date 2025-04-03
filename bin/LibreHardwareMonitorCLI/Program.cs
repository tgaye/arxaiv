// LibreHardwareMonitorCLI.cs
using System;
using System.Text.Json;
using LibreHardwareMonitor.Hardware;
namespace LibreHardwareMonitorCLI
{
    public class Program
    {
        public class UpdateVisitor : IVisitor
        {
            public void VisitComputer(IComputer computer)
            {
                computer.Traverse(this);
            }
            public void VisitHardware(IHardware hardware)
            {
                hardware.Update();
                foreach (var subHardware in hardware.SubHardware)
                    subHardware.Accept(this);
            }
            public void VisitSensor(ISensor sensor) { }
            public void VisitParameter(IParameter parameter) { }
        }
        static void Main(string[] args)
        {
            bool jsonOutput = args.Length > 0 && args[0] == "--json";
            bool runOnce = args.Length > 1 && args[1] == "--once";
            var computer = new Computer
            {
                IsCpuEnabled = true,
                IsGpuEnabled = true,
                IsMemoryEnabled = true,
                IsMotherboardEnabled = true,
                IsNetworkEnabled = true,
                IsStorageEnabled = true
            };
            computer.Open();
            computer.Accept(new UpdateVisitor());
            var gpuData = new System.Collections.Generic.List<object>();
            foreach (var hardware in computer.Hardware)
            {
                if (hardware.HardwareType == HardwareType.GpuNvidia || 
                    hardware.HardwareType == HardwareType.GpuAmd || 
                    hardware.HardwareType == HardwareType.GpuIntel)
                {
                    var gpuInfo = new System.Collections.Generic.Dictionary<string, object>();
                    gpuInfo["name"] = hardware.Name;

                    foreach (var sensor in hardware.Sensors)
                    {
                        if (sensor.SensorType == SensorType.Load && sensor.Name.Contains("GPU Core"))
                            gpuInfo["load"] = sensor.Value;
                        else if (sensor.SensorType == SensorType.Temperature && sensor.Name.Contains("GPU Core"))
                            gpuInfo["temperature"] = sensor.Value;
                        else if (sensor.SensorType == SensorType.SmallData && sensor.Name.Contains("GPU Memory Total"))
                            gpuInfo["memoryTotal"] = sensor.Value * 1024 * 1024; // Convert to bytes
                        else if (sensor.SensorType == SensorType.SmallData && sensor.Name.Contains("GPU Memory Used"))
                            gpuInfo["memoryUsed"] = sensor.Value * 1024 * 1024; // Convert to bytes
                    }

                    gpuData.Add(gpuInfo);
                }
            }
            var result = new System.Collections.Generic.Dictionary<string, object>();
            result["gpu"] = gpuData;
            string jsonString = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
            Console.WriteLine(jsonString);
            computer.Close();
        }
    }
}