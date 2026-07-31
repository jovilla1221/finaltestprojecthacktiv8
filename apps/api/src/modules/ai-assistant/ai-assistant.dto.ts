import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Pesan tidak boleh kosong' })
  @MaxLength(2000, { message: 'Pesan maksimal 2000 karakter' })
  message!: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;
}
