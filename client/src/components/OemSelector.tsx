import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOemContext } from '@/hooks/use-oem-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ArrowRight } from 'lucide-react';

interface Oem {
  id: string;
  name: string;
  code: string;
}

export function OemSelector() {
  const { availableOems, setSelectedOemId, isPartnerUser } = useOemContext();
  const [tempSelectedOem, setTempSelectedOem] = useState<string>('');

  // Fetch OEM details for available OEMs
  const { data: oems = [], isLoading } = useQuery<Oem[]>({
    queryKey: ['/api/oems'],
    enabled: isPartnerUser && availableOems.length > 0
  });

  // Filter OEMs to only show available ones
  const availableOemDetails = oems.filter((oem: Oem) => 
    availableOems.includes(oem.id)
  );

  const handleContinue = () => {
    if (tempSelectedOem) {
      setSelectedOemId(tempSelectedOem);
    }
  };

  if (!isPartnerUser || availableOems.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Select OEM</CardTitle>
          <CardDescription>
            Choose which OEM you want to work with for this session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <Select 
                value={tempSelectedOem} 
                onValueChange={setTempSelectedOem}
                data-testid="select-oem"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an OEM" />
                </SelectTrigger>
                <SelectContent>
                  {availableOemDetails.map((oem: Oem) => (
                    <SelectItem key={oem.id} value={oem.id}>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{oem.name}</span>
                        <span className="text-muted-foreground">({oem.code})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleContinue}
                disabled={!tempSelectedOem}
                className="w-full"
                data-testid="button-continue-oem"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
          
          <div className="text-xs text-muted-foreground text-center">
            You have access to {availableOems.length} OEM{availableOems.length !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}