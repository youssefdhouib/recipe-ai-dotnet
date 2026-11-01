using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Services;

public class NotificationService
{
    private readonly AppDbContext _db;

    public NotificationService(AppDbContext db)
    {
        _db = db;
    }

    // Adds the notification to the current unit of work WITHOUT saving.
    // The caller saves once, so "review + notification" are written in the same transaction.
    public void Add(string userId, string text, string link)
    {
        _db.Notifications.Add(new Notification { UserId = userId, Text = text, Link = link });
    }

    public async Task<IReadOnlyList<NotificationDto>> GetForUserAsync(string userId) =>
        await _db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedOn)
            .Take(50)
            .Select(n => new NotificationDto(n.Id, n.Text, n.Link, n.IsRead, n.CreatedOn))
            .ToListAsync();

    public async Task<UnreadCountDto> GetUnreadCountAsync(string userId) =>
        new(await _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead));

    public async Task MarkAsReadAsync(int id, string userId)
    {
        var notification = await GetOwnedAsync(id, userId);
        notification.IsRead = true;
        await _db.SaveChangesAsync();
    }

    // ExecuteUpdateAsync: one SQL UPDATE for all rows, without loading them into memory.
    public Task<int> MarkAllAsReadAsync(string userId) =>
        _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(setters => setters.SetProperty(n => n.IsRead, true));

    public async Task DeleteAsync(int id, string userId)
    {
        _db.Notifications.Remove(await GetOwnedAsync(id, userId));
        await _db.SaveChangesAsync();
    }

    // Someone else's notification looks like it doesn't exist (404), so ids can't be probed.
    private async Task<Notification> GetOwnedAsync(int id, string userId) =>
        await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId)
        ?? throw new NotFoundException("Notification not found.");
}
