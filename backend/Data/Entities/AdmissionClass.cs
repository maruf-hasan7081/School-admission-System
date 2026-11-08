namespace SchoolAdmission.Api.Data.Entities;

public class AdmissionClass
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public int TotalSeats { get; set; }

    public ICollection<Hold> Holds { get; set; } = new List<Hold>();
}
