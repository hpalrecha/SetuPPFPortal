import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail } from "lucide-react";

export function EmailTest() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Test Email from SetuPPF");
  const [message, setMessage] = useState("This is a test email to verify AWS SES integration is working properly.");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendTest = async () => {
    if (!to || !subject || !message) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/test-email", {
        to,
        subject,
        message
      });

      if (response.ok) {
        toast({
          title: "Email Sent Successfully",
          description: "Test email has been sent. Check your inbox and spam folder."
        });
        // Clear form
        setTo("");
        setMessage("This is a test email to verify AWS SES integration is working properly.");
      } else {
        throw new Error("Failed to send email");
      }
    } catch (error) {
      console.error("Email test error:", error);
      toast({
        title: "Email Failed",
        description: "Failed to send test email. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Mail className="w-5 h-5" />
          Email Service Test
        </CardTitle>
        <CardDescription>
          Test AWS SES email functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="to">To Email Address</Label>
          <Input
            id="to"
            type="email"
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            data-testid="input-email-to"
          />
        </div>
        
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            data-testid="input-email-subject"
          />
        </div>
        
        <div>
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder="Email message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            data-testid="textarea-email-message"
          />
        </div>
        
        <Button
          onClick={handleSendTest}
          disabled={isLoading}
          className="w-full"
          data-testid="button-send-test-email"
        >
          {isLoading ? "Sending..." : "Send Test Email"}
        </Button>
      </CardContent>
    </Card>
  );
}